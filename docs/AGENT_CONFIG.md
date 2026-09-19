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

---

## 5. Creating the agent in the ElevenLabs dashboard

The frontend widget (`frontend/src/components/VoiceAgent.jsx` and
`frontend/src/lib/voice.js`) starts a session with only an agent id, no
server-issued token, so the agent must be reachable that way. These steps
build it from scratch.

1. Sign in at elevenlabs.io and open Agents, then Create an agent. Pick the
   Conversational AI agent type, not a plain text-to-speech voice.
2. Paste the system prompt from section 1 above, verbatim, into the agent's
   system prompt field. Do not let the dashboard's default starter prompt
   survive alongside it.
3. Under Security, leave the agent set to public (no authentication
   required to start a session). The browser widget calls
   `Conversation.startSession({ agentId })` directly with no signed URL and
   no server-issued token, so a private agent will refuse every session
   from the browser. Making an agent private and brokering a signed URL
   through the backend is possible but is a separate change to `main.py`,
   not part of this wiring.
4. Pick a voice per section 3, and set it on the agent.
5. Add both server tools from section 2 (`report_symptom` and
   `book_appointment`). For each tool's URL, use
   `https://<your-deployed-backend>/webhook/elevenlabs`, the same backend
   from `docs/DEPLOY.md`. Set the `secret` field on each tool to the exact
   value of the server's `CARELOOP_WEBHOOK_SECRET`. This is a hardcoded
   value on the tool definition, not something the agent infers from the
   call.
6. Leave the agent's own post-call webhook OFF. CareLoop does not use it:
   transcript capture happens client side, from the SDK's message events in
   the browser, and is posted straight to this backend's own `/triage`
   route. A post-call webhook needs a public callback URL reachable from
   ElevenLabs' servers, which is unavailable on localhost and unreliable on
   conference wifi, so the demo path does not depend on it.
7. Find the agent id on the agent's overview page, in the URL
   (`/app/agents/<agent id>`) or in Settings. It looks like
   `agent_01xxxxxxxxxxxxxxxxxxxxxxxx`.
8. Set `VITE_ELEVENLABS_AGENT_ID` to that id: in `frontend/.env` for local
   development, and as a build time environment variable on whichever host
   serves the frontend bundle (Vercel project settings, or the environment
   used to run `npm run build` before a GitHub Pages deploy). Rebuild the
   frontend after setting it; Vite inlines `VITE_*` variables at build time,
   so changing the value requires a new build, not just a page refresh.
9. Until that variable is set, `VoiceAgent` renders a plain "voice agent not
   configured" panel naming `VITE_ELEVENLABS_AGENT_ID` instead of a blank
   space or a crash, so the rest of the console stays usable while the
   agent id is still being sourced.

### Dynamic variables the frontend sends

`VoiceAgent` passes `patient_id` and `patient_first_name` as
`dynamicVariables` on every session, drawn from the patient selected in the
judge console. The greeting in section 1 also references `{medication}`
and a dosage; those come from the patient's schedule and are not sent by
this component, because the judge console does not load a patient's full
medication schedule the way the patient dashboard does. If the widget is
later mounted somewhere that already has that schedule loaded, add the
medication name and dosage to the same `dynamicVariables` call in
`frontend/src/lib/voice.js` and reference them from the system prompt with
`{{medication}}` and `{{dosage}}`.

### What this build intentionally does not do

`VoiceAgent` itself still only answers a browser mic session; it never
places a phone call. Section 6 below documents a separate path, in
`main.py` and `telephony.py`, that does place real outbound phone calls
through Twilio. That path dials exactly one number, `DEMO_PHONE_NUMBER`,
never a number taken from a request, so it is the operator hearing both
sides of the demo, not a real patient or a real clinic.

---

## 6. Real outbound phone calls (Twilio)

This is separate from the ElevenLabs browser widget above. It exists so
the person running the demo can hold their own phone and hear both legs
of a call actually ring and connect: the check-in call to the patient
side, and the clinic call CareLoop places once it books a follow-up. Both
legs dial the same number on purpose, the operator's own phone, so there
is one real call to listen to instead of two people needing two phones.

### Environment variables

Set these on the server (`.env` locally, the platform's environment
variable settings when deployed). All four must be present and non empty
before any call will place; an empty string counts as not set, the same
rule `/health` already applies to every other key.

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+15551234567
DEMO_PHONE_NUMBER=+15559876543
```

- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` come from the Twilio
  Console dashboard's Account Info panel.
- `TWILIO_FROM_NUMBER` is a phone number owned by that Twilio account
  (Console, Phone Numbers, Active Numbers), in E.164 format
  (`+`, country code, number, no spaces or punctuation).
- `DEMO_PHONE_NUMBER` is the operator's own phone, also in E.164 format.
  This is the only number this codebase will ever dial; it is never
  accepted from a request body.

`GET /health` reports `telephony_configured` and, when false,
`telephony_missing`, naming exactly which of the four variables are
absent, the same pattern used for the Gemini and webhook keys.

### Before a call will connect, in the Twilio Console

- Create a Twilio account and a project if one does not exist yet.
- Buy or claim a phone number and use it as `TWILIO_FROM_NUMBER`.
- **Trial accounts only:** a trial account can only call phone numbers
  that have been verified in the Console (Phone Numbers, Verified Caller
  IDs). Verify `DEMO_PHONE_NUMBER` there before testing, or every call
  attempt will be rejected by Twilio. A trial account also plays an
  audible "this call is from a trial account" notice before the call
  connects; that notice is Twilio's, not something this codebase can
  suppress, and it is expected, not a bug.
- Upgrading the account (adding a payment method) removes both the
  verified-number restriction and the trial notice.

### Endpoints

- `POST /call/start` places the check-in leg to `DEMO_PHONE_NUMBER`.
  Gated by `CARELOOP_WEBHOOK_SECRET`, sent as a `secret` field in the JSON
  body, the same convention as `/webhook/elevenlabs`. Optional
  `patient_id` in the body picks whose script is used; defaults to `p1`.
- `POST /call/clinic` places the clinic leg the same way, gated the same
  way, with an optional `specialty`.
- Both return `{"configured": false, "missing_env": [...], "detail": ...}`
  instead of an error when telephony is not set up, and a rate limited
  request gets a `429`.
- `GET`/`POST /voice/checkin` and `GET`/`POST /voice/clinic` are the TwiML
  documents Twilio fetches once a call connects. They are intentionally
  public; Twilio cannot send the shared secret. Both open by identifying
  the call as automated, and the clinic leg additionally speaks
  `clinic.FRONT_DESK_DISCLOSURE` out loud before anything else, the same
  disclosure the text based simulation already carries.
- `POST /loop/run` places the clinic leg automatically once it produces a
  booking, if telephony is configured, using the same rate limiter. When
  it is not configured, or the limiter is at capacity, it emits a
  `PHONE_CALL_NOT_CONFIGURED` trace event instead of silently skipping.

### Rate limits, and what is never logged

Call placement is capped at a few calls per minute per session and a
fixed number of calls for the lifetime of the running process (see
`telephony.py`), because these endpoints sit on the public internet
behind a single shared secret. No endpoint anywhere accepts a phone
number in a request; `DEMO_PHONE_NUMBER` is the only number ever dialed.
Trace events and API responses only ever carry a masked version of a
phone number, for example `*******6543`, never the full number.
