import os
from pathlib import Path

from dotenv import load_dotenv

REQUIRED = [
    ("GEMINI_API_KEY", "Tier 1 triage classifier", True),
    ("ELEVENLABS_API_KEY", "voice agent / TTS", False),
    ("TWILIO_ACCOUNT_SID", "outbound calling", False),
    ("TWILIO_AUTH_TOKEN", "outbound calling", False),
    ("BACKBOARD_API_KEY", "backboard", False),
    ("CARELOOP_WEBHOOK_SECRET", "gates the agent webhook and trace stream", False),
    ("GEMINI_MODEL", "overrides the Tier 1 model id", False),
]

env_path = Path(__file__).parent / ".env"

print(f"\n.env: {env_path}")
if not env_path.exists():
    print("  MISSING -- the app reads .env, not .env.example.")
    print("  Create it with:  cp .env.example .env   then fill in the values.\n")
    raise SystemExit(1)

print("  found\n")
load_dotenv(env_path)

missing_required = []
for name, purpose, required in REQUIRED:
    value = (os.environ.get(name) or "").strip()
    if value:

        status = f"SET ({len(value)} chars, ...{value[-4:]})"
    else:
        status = "MISSING" if required else "empty (not wired up yet)"
        if required:
            missing_required.append(name)
    print(f"  {name:22} {status:34} {purpose}")

print()
if missing_required:
    print(f"Required key(s) missing: {', '.join(missing_required)}")
    print("Tier 0 emergency detection still works without them.")
    print("Tier 1 will report 'classifier unavailable' and fail toward MODERATE.\n")
    raise SystemExit(1)

print("Required keys present. Tier 1 is live.\n")
