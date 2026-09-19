import importlib.util
import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent


def load_wrapper():
    spec = importlib.util.spec_from_file_location("careloop_api_index", ROOT / "api" / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


wrapper = load_wrapper()
client = TestClient(wrapper.app)


def headers(name):
    return {"X-CareLoop-Session": name}


def callback_urls(xml):
    return re.findall(r'(?:action|url)="([^"]+)"', xml.replace("&amp;", "&"))


def test_the_deployment_serves_the_api_under_its_prefix():
    assert client.get("/api/health").status_code == 200


def test_every_callback_url_keeps_the_deployment_prefix():
    xml = client.get("/api/voice/checkin?patient_id=p1", headers=headers("wrap-prefix")).text
    urls = callback_urls(xml)
    assert urls, "the gather must post somewhere"
    for url in urls:
        assert url.startswith("http"), f"{url} is relative"
        assert "/api/" in url, (
            f"{url} drops the /api prefix the deployment routes on. Twilio posts "
            "there, gets no route, and the caller hears an application error."
        )


def test_the_url_the_gather_names_actually_answers():
    xml = client.get("/api/voice/checkin?patient_id=p1", headers=headers("wrap-live")).text
    action = callback_urls(xml)[0]
    path = action.split("testserver", 1)[1]
    answered = client.post(
        path, data={"SpeechResult": "i took it, feeling fine", "CallSid": "CAwrap"},
        headers=headers("wrap-live"),
    )
    assert answered.status_code == 200, (
        "the gather pointed at a path the deployment does not serve"
    )
    assert "<Say" in answered.text


@pytest.mark.parametrize("path", ["/api/health", "/api/followups/p1", "/api/call/state"])
def test_the_routes_a_judge_can_reach_are_served_under_the_prefix(path):
    assert client.get(path, headers=headers("wrap-routes")).status_code == 200


def test_every_hop_of_a_multi_turn_call_keeps_the_prefix(monkeypatch):
    import conversation

    monkeypatch.setattr(conversation, "is_configured", lambda: True)
    monkeypatch.setattr(
        conversation, "reply",
        lambda history, context: {
            "say": "Tell me more about that.", "end_call": False, "offer_booking": False,
        },
    )

    session = headers("wrap-multi-turn")
    xml = client.get("/api/voice/checkin?patient_id=p1", headers=session).text
    for turn in range(3):
        urls = callback_urls(xml)
        assert urls, f"turn {turn} of the call has nothing for the caller to speak into"
        for url in urls:
            assert url.startswith("http"), f"turn {turn}: {url} is relative"
            assert "/api/" in url, (
                f"turn {turn}: {url} drops the /api prefix. On a live phone call "
                "Twilio resolves this relative to the deployment root, gets the "
                "single page app back instead of TwiML, and the call dies."
            )
        path = urls[0].split("testserver", 1)[1]
        response = client.post(
            path, data={"SpeechResult": "I have been feeling dizzy", "CallSid": "CAmultiturn"},
            headers=session,
        )
        assert response.status_code == 200
        xml = response.text
        if "<Gather" not in xml:
            break
