from triage_engine import Severity

SUGGESTED_RESPONSE = {
    Severity.MILD: (
        "Got it, thanks for letting me know. I'll make a note of that and "
        "we'll check in again next time."
    ),
    Severity.MODERATE: (
        "I'm sorry to hear that. I'd like to get you a follow-up appointment "
        "to look into this, would that be okay?"
    ),
    Severity.SEVERE: (
        "Thank you for telling me. That sounds like something a clinician "
        "should look at today. I'd like to get you seen as soon as possible, "
        "is that alright?"
    ),
    Severity.EMERGENCY: (
        "I want to stop here for a moment. Based on what you've described, "
        "please call 911 or get to an emergency room right now. I am writing "
        "this down on your record for your care team. I cannot contact anyone "
        "for you, so please make that call yourself."
    ),
}


CRISIS_RESPONSE = (
    "I'm really glad you told me that. I want to connect you with someone "
    "who can help right now. You can call or text 988, the Suicide and "
    "Crisis Lifeline, any time. I'm going to stay on the line with you."
)


def suggested_response(severity: Severity, is_crisis: bool = False) -> str:
    if is_crisis:
        return CRISIS_RESPONSE
    return SUGGESTED_RESPONSE[severity]
