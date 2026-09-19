# CareLoop Voice Agent Configuration

This is the hand-configuration guide for the ElevenLabs conversational agent
used in the CareLoop demo. There is no exported agent JSON in this repo
(the agent lives in the ElevenLabs dashboard, not in source control), so this
document is the source of truth for how it is built and how to rebuild it if
it is ever lost.

Read this alongside `docs/PLAN.md` sections 0.2 and 5, which are the source
of the two required behavior changes below. This document does not restate
a full "original spec" file, because no such file exists in this repository;
the system prompt below is written from PLAN.md's description of what
changed and why, applied against the actual `/webhook/elevenlabs` contract
in `main.py`.

---

## 1. System prompt

Paste this into the agent's system prompt field. Do not let the agent
improvise around it, especially the emergency and crisis branches.

```
You are the CareLoop check-in agent. You place a short, friendly call to a
patient to ask how they are doing on their medication. You are not a
clinician and you do not give medical advice.

You will be given the patient's first name, their medication name, and
their dosage in context before the call starts. Use them.

GREETING (say this first, every call):
"Hi {patient_first_name}, this is CareLoop calling to check in on your
{medication}. Quick note, I'm an automated check-in assistant, not a
medical professional, and this is a demonstration. Do you have a couple
of minutes?"

Do not skip the self-identification line. It is required on every call,
not just the first one. Always greet the patient by name: this is a call
to a person who is expecting it, not a cold call.

YOUR JOB, IN ORDER:
1. Confirm you're speaking with the right patient.
2. Ask whether they took their medication as scheduled today, naming the
   medication and dosage from context, for example "your 500mg metformin
   this morning". Use the schedule the portal gave you for this patient.
3. Ask how they are feeling. Listen for anything beyond "fine" -- side
   effects, new symptoms, anything that sounds off. When the patient
   reports any symptom, whether mild or serious, call the report_symptom
   tool with a transcript of what they said. Do not decide severity
   yourself: that judgment belongs to the triage service behind the tool,
   not to you.
4. Read the tool result back to the patient using its
   suggested_agent_response field, in your own natural voice, but do not
   change its meaning and do not add medical advice of your own. Then
   branch on the result exactly as follows:

   - If is_crisis is true (a mental health crisis, such as a disclosure of
     wanting to harm themselves): do NOT end the call. Say you are glad
     they told you. Offer that they can call or text 988, the Suicide and
     Crisis Lifeline, right now. Stay on the line with them. Keep talking
     gently and do not rush to hang up. This applies even though the
     severity is the same EMERGENCY level as a medical emergency: the
     response is different on purpose.

   - If is_crisis is false and the tier is "emergency" (a medical
     emergency, such as chest pain or unresponsiveness): tell the patient
     clearly to call 911 or get to an emergency room right now, and tell
     them you are alerting their care team. It is fine to end the call
     after this, once you've made sure they understand what to do.

   - For any other tier (mild, moderate, severe): read back the suggested
     response, ask any brief follow-up the response invites (for example,
     offering to book a follow-up appointment), and continue the check-in.

5. If the patient agrees to a follow-up appointment, call the
   book_appointment tool with the specialty that fits what they described
   and the urgency level implied by the tier. Never call book_appointment
   for an emergency call; emergencies are directed to 911 or 988, not
   scheduled.
6. Thank the patient and end the call warmly.

PACING:
Keep the whole call under 90 seconds unless the patient needs more time.
A crisis is always an exception: never cut a crisis call short to stay
inside the time budget.

HARD RULES:
- Never invent a diagnosis, a medication change, or a piece of medical
  advice. If you don't have it from a tool result, don't say it.
- Never tell a patient in crisis to just call 911 and then hang up.
- Never end the call while a crisis is in progress.
- Always speak the suggested_agent_response content faithfully. You may
  soften phrasing for natural speech, but do not remove the 911 or 988
  instruction, and do not remove the self-identification line from the
  greeting.
- If a tool call fails or times out, tell the patient you're having
  trouble reaching the system and that you'll have someone follow up, do
  not guess at a severity yourself.
```

### Why the emergency branch changed

The original draft of this prompt told the agent to say "seek emergency
care immediately" for every emergency and then end the call. That is the
right move for a medical emergency and the wrong move for a mental health
crisis: directing someone who just disclosed suicidal ideation to police
and then hanging up is contraindicated by most crisis guidance. The
`/triage` response now carries an `is_crisis` boolean specifically so the
agent can tell the two apart and route them differently while keeping the
same EMERGENCY severity floor for both. See `docs/PLAN.md` section 0.2 and
`responses.py`.

---

## 2. Tool schemas

These must match the request body FastAPI actually accepts at
`POST /webhook/elevenlabs` in `main.py`. That endpoint takes one shape for
both tools, keyed by `tool_name`, and every request must carry the shared
secret.

### Shared secret

The webhook checks a field called `secret` against the server's
`CARELOOP_WEBHOOK_SECRET` environment variable. If the server variable is
unset, the check is skipped (useful for local dev only). For any deployed
instance, set `CARELOOP_WEBHOOK_SECRET` on the server and configure the
agent to send the same value as `secret` on every tool call. In the
ElevenLabs dashboard this is set as a static/hardcoded value on each tool
definition, not something the agent has to say or infer.

There is no separate HTTP header for the secret. It is a field in the
JSON body, alongside the other tool arguments.

### report_symptom

```json
{
  "name": "report_symptom",
  "description": "Report what the patient said about how they are feeling, so the CareLoop triage service can classify severity and return what to say next. Call this any time the patient describes a symptom, side effect, or anything other than a plain 'I'm fine'.",
  "url": "https://<your-deployed-backend>/webhook/elevenlabs",
  "method": "POST",
  "parameters": {
    "type": "object",
    "properties": {
      "tool_name": {
        "type": "string",
        "const": "report_symptom",
        "description": "Fixed value, always 'report_symptom'."
      },
      "patient_id": {
        "type": "string",
        "description": "The patient id given by the portal at the start of the call, e.g. 'p1'."
      },
      "transcript": {
        "type": "string",
        "description": "What the patient said about their symptom, as close to their own words as possible. Do not summarize away detail."
      },
      "secret": {
        "type": "string",
        "description": "Shared secret configured on this tool. Not spoken, not derived from the conversation."
      }
    },
    "required": ["tool_name", "patient_id", "transcript", "secret"]
  }
}
```

Response shape the agent receives back (from `run_triage` in `main.py`):

```json
{
  "tier": "mild | moderate | severe | emergency",
  "source": "rule | llm | fallback_error",
  "normalized_text": "string or null",
  "confidence": "number or null",
  "reasoning": "string",
  "suggested_agent_response": "string, the exact line to read back",
  "is_crisis": "boolean",
  "is_emergency": "boolean",
  "matched_rules": ["string", "..."],
  "patient_id": "string or null",
  "transcript": "string"
}
```

### book_appointment

```json
{
  "name": "book_appointment",
  "description": "Book a follow-up appointment for the patient once they have agreed to one. Never call this for an emergency.",
  "url": "https://<your-deployed-backend>/webhook/elevenlabs",
  "method": "POST",
  "parameters": {
    "type": "object",
    "properties": {
      "tool_name": {
        "type": "string",
        "const": "book_appointment",
        "description": "Fixed value, always 'book_appointment'."
      },
      "patient_id": {
        "type": "string",
        "description": "The patient id given by the portal at the start of the call."
      },
      "specialty": {
        "type": "string",
        "description": "One of: Internal Medicine, Endocrinology, Cardiology, Emergency Medicine. Pick the one that fits what the patient described."
      },
      "urgency": {
        "type": "string",
        "enum": ["routine", "urgent"],
        "description": "routine for mild/moderate follow-up, urgent for severe. Do not use for emergency severity; do not call this tool at all for emergencies."
      },
      "secret": {
        "type": "string",
        "description": "Shared secret configured on this tool. Not spoken, not derived from the conversation."
      }
    },
    "required": ["tool_name", "patient_id", "specialty", "urgency", "secret"]
  }
}
```

Response shape:

```json
{
  "confirmed": true,
  "provider_name": "string",
  "time": "ISO 8601 timestamp",
  "specialty": "string"
}
```

Note: booking never removes the slot it returns (see `providers.py`), so the
same demo can be run repeatedly without running out of appointment times.
`Emergency Medicine` has no bookable slots on purpose; do not route a
booking call there.

---

## 3. Voice selection guidance

Pick a stock ElevenLabs voice. Do not clone a real person's voice for this
project, for a demo or otherwise.

What to look for:
- Warm and mid-pitched. This is a call about someone's health; a voice that
  sounds like it cares lands better than one that sounds like a notification.
- Unhurried pacing. The agent needs to ask about symptoms and actually wait
  for an answer, not rush through a script.

What to avoid:
- Young or overly energetic voices. Mismatched tone for a call checking on
  someone who may be unwell.
- Flat or robotic voices. Undermines the whole pitch, which is that this
  agent is careful and trustworthy, not a phone tree.

Test at least 2 or 3 stock voices with the actual greeting and the actual
emergency line before picking one. A voice that sounds warm on a generic
sentence can sound wrong reading "please call 911 right now." Listen to
that specific line before deciding.

---

## 4. Wiring checklist

Deploy the backend before building the agent config, not after. Every time
the backend URL changes, the agent config has to be re-edited and a call
has to be re-tested, so get one stable URL early and do not move it.

- [ ] Backend is deployed and reachable at a stable HTTPS URL (see
      `docs/PLAN.md` section 7 for the hosting split; the API itself has no
      hosting requirement beyond "a process that stays up").
- [ ] `GET /health` on that URL returns `{"status": "ok", ...}`.
- [ ] `CARELOOP_WEBHOOK_SECRET` is set on the server.
- [ ] Both tool definitions in the agent point at
      `POST <backend-url>/webhook/elevenlabs`.
- [ ] Both tool definitions send the same shared secret value as the
      server's `CARELOOP_WEBHOOK_SECRET`.
- [ ] A test call successfully triggers `report_symptom` for a mild symptom
      and the agent reads back the suggested response.
- [ ] A test call with an emergency phrase (for example "I can't breathe")
      triggers the emergency branch: 911, stays on script, alerts care
      team, and does NOT attempt to book an appointment.
- [ ] A test call with a crisis phrase (for example "I want to die")
      triggers the crisis branch: agent offers 988, stays on the line,
      does not end the call.
- [ ] Voice picked and confirmed against the actual emergency and crisis
      lines, not just the greeting.

If the backend URL ever changes (redeploy to a new host, new environment,
etc.), repeat the last four checks before the next demo or judging pass.
