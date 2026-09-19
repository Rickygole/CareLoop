import base64
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import List, Optional

TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"
CALL_TIMEOUT_SECONDS = 10
RING_SECONDS = 30

REQUIRED_ENV_VARS = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "DEMO_PHONE_NUMBER",
]

PER_MINUTE_LIMIT = 3
PROCESS_CALL_CAP = 20

_PROCESS_LOCK = threading.Lock()
_PROCESS_CALL_COUNT = 0

_PHONE_LIKE = re.compile(r"\+?\d[\d\-\s]{6,}\d")


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def missing_env_vars() -> List[str]:
    return [name for name in REQUIRED_ENV_VARS if not _env(name)]


def is_configured() -> bool:
    return not missing_env_vars()


def demo_phone_number() -> str:
    return _env("DEMO_PHONE_NUMBER")


def mask_phone(number: Optional[str]) -> str:
    if not number:
        return "unset"
    digits = "".join(ch for ch in number if ch.isdigit())
    if len(digits) <= 2:
        return "*" * len(digits)
    return "*" * (len(digits) - 2) + digits[-2:]


def _scrub(text: str) -> str:
    return _PHONE_LIKE.sub("[masked]", text)


def _basic_auth_header(account_sid: str, auth_token: str) -> str:
    token = base64.b64encode(f"{account_sid}:{auth_token}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


class CallLimiter:

    def __init__(self, per_minute_limit: int = PER_MINUTE_LIMIT):
        self._per_minute_limit = per_minute_limit
        self._timestamps: List[float] = []
        self._lock = threading.Lock()

    def allow(self) -> bool:
        now = time.monotonic()
        with self._lock:
            self._timestamps = [t for t in self._timestamps if now - t < 60]
            if len(self._timestamps) >= self._per_minute_limit:
                return False
        with _PROCESS_LOCK:
            if _PROCESS_CALL_COUNT >= PROCESS_CALL_CAP:
                return False
        return True

    def record(self) -> None:
        global _PROCESS_CALL_COUNT
        with self._lock:
            self._timestamps.append(time.monotonic())
        with _PROCESS_LOCK:
            _PROCESS_CALL_COUNT += 1


def send_sms(to: str, body: str) -> dict:
    missing = missing_env_vars()
    if missing:
        return {"ok": False, "sid": None, "error": "not_configured", "missing": missing}

    account_sid = _env("TWILIO_ACCOUNT_SID")
    auth_token = _env("TWILIO_AUTH_TOKEN")
    from_number = _env("TWILIO_FROM_NUMBER")

    form = {"To": to, "From": from_number, "Body": body}
    data = urllib.parse.urlencode(form).encode("utf-8")
    url = f"{TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json"
    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": _basic_auth_header(account_sid, auth_token),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=CALL_TIMEOUT_SECONDS) as response:
            import json

            payload = json.loads(response.read().decode("utf-8"))
        return {"ok": True, "sid": payload.get("sid"), "status": payload.get("status")}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return {"ok": False, "sid": None, "error": f"http_{exc.code}", "detail": _scrub(raw)[:200]}
    except Exception as exc:
        return {"ok": False, "sid": None, "error": type(exc).__name__, "detail": _scrub(str(exc))[:200]}


def place_call(
    to: str,
    twiml_url: Optional[str] = None,
    twiml: Optional[str] = None,
    status_callback: Optional[str] = None,
    ring_seconds: int = RING_SECONDS,
) -> dict:
    missing = missing_env_vars()
    if missing:
        return {"ok": False, "call_sid": None, "error": "not_configured", "missing": missing}

    if not twiml_url and not twiml:
        return {"ok": False, "call_sid": None, "error": "no_twiml_source"}

    account_sid = _env("TWILIO_ACCOUNT_SID")
    auth_token = _env("TWILIO_AUTH_TOKEN")
    from_number = _env("TWILIO_FROM_NUMBER")

    form = {"To": to, "From": from_number, "Timeout": str(ring_seconds)}
    if twiml_url:
        form["Url"] = twiml_url
    else:
        form["Twiml"] = twiml
    if status_callback:
        form["StatusCallback"] = status_callback
        form["StatusCallbackMethod"] = "POST"
        form["StatusCallbackEvent"] = "completed"

    body = urllib.parse.urlencode(form).encode("utf-8")
    url = f"{TWILIO_API_BASE}/Accounts/{account_sid}/Calls.json"
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": _basic_auth_header(account_sid, auth_token),
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=CALL_TIMEOUT_SECONDS) as response:
            import json

            data = json.loads(response.read().decode("utf-8"))
        return {"ok": True, "call_sid": data.get("sid"), "status": data.get("status")}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return {
            "ok": False,
            "call_sid": None,
            "error": "twilio_rejected_request",
            "status_code": exc.code,
            "detail": _scrub(raw)[:500],
        }
    except Exception as exc:
        return {
            "ok": False,
            "call_sid": None,
            "error": "twilio_request_failed",
            "detail": _scrub(str(exc))[:500],
        }
