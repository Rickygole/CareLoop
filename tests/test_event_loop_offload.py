import json
import socket
import threading
import time
import urllib.error
import urllib.request

import pytest
import uvicorn

import main
import telephony


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture()
def live_server():
    port = _free_port()
    config = uvicorn.Config(main.app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    assert server.started, "server never came up"
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=10)


def _post(base, path, payload, timeout=30):
    request = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", main.SESSION_HEADER: "offload-test"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def _health_latency(base):
    request = urllib.request.Request(base + "/health")
    started = time.monotonic()
    with urllib.request.urlopen(request, timeout=30) as response:
        response.read()
    return time.monotonic() - started


BLOCK_SECONDS = 2.0


def _slow_place_call(to, **kwargs):
    time.sleep(BLOCK_SECONDS)
    return {"ok": True, "call_sid": "CA_slow", "status": "queued"}


@pytest.mark.parametrize(
    "path,payload",
    [
        ("/call/start", {"patient_id": "p1"}),
        ("/call/clinic", {"patient_id": "p1", "specialty": "Cardiology"}),
    ],
)
def test_event_loop_survives_a_slow_dial(live_server, monkeypatch, path, payload):
    monkeypatch.setattr(telephony, "missing_env_vars", lambda: [])
    monkeypatch.setattr(telephony, "demo_phone_number", lambda: "+15550001111")
    monkeypatch.setattr(telephony, "place_call", _slow_place_call)

    body = dict(payload)
    body["secret"] = main.CALL_TOKEN or main.WEBHOOK_SECRET

    assert _health_latency(live_server) < 1.0

    dialler = threading.Thread(target=_post, args=(live_server, path, body))
    dialler.start()
    time.sleep(0.4)
    latency = _health_latency(live_server)
    dialler.join(timeout=30)

    assert latency < 1.0, f"/health took {latency:.2f}s while a call was being dialled"
