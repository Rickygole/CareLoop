import importlib.util
from pathlib import Path
from urllib.parse import parse_qsl

import pytest
from fastapi.testclient import TestClient

import main
import twilio_signature

ROOT = Path(__file__).resolve().parent.parent


def load_wrapper():
    spec = importlib.util.spec_from_file_location("careloop_api_index_sig", ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


wrapper = load_wrapper()
client = TestClient(wrapper.app, base_url="https://careloop-woad.vercel.app")

TOKEN = "test-auth-token-1234567890"


@pytest.fixture(autouse=True)
def require_signatures(monkeypatch):
    monkeypatch.setenv(main.TWILIO_VALIDATE_SIGNATURES_ENV, "1")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", TOKEN)


def sign(url, form):
    return twilio_signature.compute_signature(TOKEN, url, form)


def test_a_correctly_signed_real_shaped_request_is_accepted():
    form = {"CallSid": "CAxyz", "SpeechResult": "I took it, feeling fine"}
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data=form,
        headers={"X-Twilio-Signature": sign(url, form)},
    )
    assert response.status_code == 200, response.text
    assert "<Response" in response.text


def test_a_request_with_no_signature_is_rejected():
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data={"CallSid": "CAxyz", "SpeechResult": "hello"},
    )
    assert response.status_code == 403


def test_a_forged_signature_is_rejected():
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data={"CallSid": "CAxyz", "SpeechResult": "hello"},
        headers={"X-Twilio-Signature": "not-a-real-signature"},
    )
    assert response.status_code == 403


def test_a_tampered_body_invalidates_a_previously_valid_signature():
    form = {"CallSid": "CAxyz", "SpeechResult": "I took it, feeling fine"}
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    good_signature = sign(url, form)
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data={"CallSid": "CAxyz", "SpeechResult": "actually take double the dose"},
        headers={"X-Twilio-Signature": good_signature},
    )
    assert response.status_code == 403


def test_the_opener_endpoint_also_requires_a_valid_signature():
    url = "https://careloop-woad.vercel.app/api/voice/checkin?patient_id=p1"
    response = client.post(
        "/api/voice/checkin?patient_id=p1",
        data={"CallSid": "CAxyz", "From": "+15550001111", "To": "+15550002222"},
        headers={"X-Twilio-Signature": sign(url, {
            "CallSid": "CAxyz", "From": "+15550001111", "To": "+15550002222",
        })},
    )
    assert response.status_code == 200

    unsigned = client.post(
        "/api/voice/checkin?patient_id=p1",
        data={"CallSid": "CAxyz", "From": "+15550001111", "To": "+15550002222"},
    )
    assert unsigned.status_code == 403


def test_a_get_request_is_rejected_when_signatures_are_required():
    response = client.get("/api/voice/checkin/hold?patient_id=p1")
    assert response.status_code == 403, (
        "the route accepts GET and POST but only POST was ever checked, so "
        "anyone could bypass the signature requirement entirely just by "
        "using GET instead of POST"
    )


def test_a_blank_valued_field_still_validates():
    form = {
        "CallSid": "CAxyz", "SpeechResult": "I took it, feeling fine",
        "Digits": "", "CallerName": "",
    }
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data=form,
        headers={"X-Twilio-Signature": sign(url, form)},
    )
    assert response.status_code == 200, (
        "a real Twilio Gather callback routinely includes blank fields like "
        "Digits, and Twilio signs the blank value as part of the request; "
        "dropping it before hashing produces a signature mismatch and "
        "rejects a completely legitimate call"
    )


def test_vercels_injected_path_query_param_does_not_break_a_real_signature():
    form = {"CallSid": "CAxyz", "SpeechResult": "I took it, feeling fine"}
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1&path=voice%2Fcheckin%2Frespond",
        data=form,
        headers={"X-Twilio-Signature": sign(url, form)},
    )
    assert response.status_code == 200, response.text


def test_with_the_flag_off_every_call_behaves_exactly_as_before(monkeypatch):
    monkeypatch.setenv(main.TWILIO_VALIDATE_SIGNATURES_ENV, "0")
    response = client.post(
        "/api/voice/checkin/respond?patient_id=p1",
        data={"CallSid": "CAxyz", "SpeechResult": "hello"},
    )
    assert response.status_code == 200


def test_a_path_merely_starting_with_api_is_not_treated_as_the_api_prefix():
    response = client.get("/apifoo")
    assert response.status_code == 404


def test_the_api_prefix_is_still_stripped_correctly_for_a_real_route():
    response = client.get("/api/health")
    assert response.status_code == 200


def test_a_generated_action_url_is_exactly_what_the_validator_reconstructs():
    opener = client.post(
        "/api/voice/checkin?patient_id=p1",
        data={"CallSid": "CAone"},
        headers={"X-Twilio-Signature": sign(
            "https://careloop-woad.vercel.app/api/voice/checkin?patient_id=p1",
            {"CallSid": "CAone"},
        )},
    )
    assert opener.status_code == 200
    action = [
        v for k, v in parse_qsl(opener.text.replace("&amp;", "&"))
        if False
    ]
    import re
    action_url = re.search(r'action="([^"]+)"', opener.text).group(1).replace("&amp;", "&")
    assert action_url.startswith("https://careloop-woad.vercel.app/api/voice/checkin/respond")

    from urllib.parse import urlsplit, parse_qsl as pq
    split = urlsplit(action_url)
    action_form = {"CallSid": "CAone", "SpeechResult": "I feel fine"}
    next_response = client.post(
        split.path + "?" + split.query,
        data=action_form,
        headers={"X-Twilio-Signature": sign(action_url, action_form)},
    )
    assert next_response.status_code == 200, next_response.text
