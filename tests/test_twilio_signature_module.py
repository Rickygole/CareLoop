import twilio_signature


def test_a_correctly_computed_signature_validates():
    token = "my-auth-token"
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    params = {"SpeechResult": "I took it", "CallSid": "CAxyz"}
    sig = twilio_signature.compute_signature(token, url, params)
    assert twilio_signature.valid_signature(token, url, params, sig)


def test_a_tampered_param_is_rejected():
    token = "my-auth-token"
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond?patient_id=p1"
    sig = twilio_signature.compute_signature(token, url, {"SpeechResult": "I took it"})
    assert not twilio_signature.valid_signature(
        token, url, {"SpeechResult": "double the dose"}, sig,
    )


def test_a_tampered_url_is_rejected():
    token = "my-auth-token"
    params = {"SpeechResult": "I took it"}
    sig = twilio_signature.compute_signature(
        token, "https://careloop-woad.vercel.app/api/voice/checkin/respond", params,
    )
    assert not twilio_signature.valid_signature(
        token, "https://evil.example.com/api/voice/checkin/respond", params, sig,
    )


def test_the_wrong_auth_token_is_rejected():
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond"
    params = {"SpeechResult": "I took it"}
    sig = twilio_signature.compute_signature("real-token", url, params)
    assert not twilio_signature.valid_signature("wrong-token", url, params, sig)


def test_an_explicit_default_port_still_validates():
    token = "my-auth-token"
    params = {"SpeechResult": "I took it"}
    url = "https://careloop-woad.vercel.app/api/voice/checkin/respond"
    url_with_port = "https://careloop-woad.vercel.app:443/api/voice/checkin/respond"
    sig = twilio_signature.compute_signature(token, url, params)
    assert twilio_signature.valid_signature(token, url_with_port, params, sig), (
        "Twilio's own signature generation is inconsistent about the default "
        "port, both forms of the url must validate against the same signature"
    )


def test_no_params_still_validates():
    token = "my-auth-token"
    url = "https://careloop-woad.vercel.app/api/voice/checkin"
    sig = twilio_signature.compute_signature(token, url, {})
    assert twilio_signature.valid_signature(token, url, {}, sig)


def test_an_empty_signature_never_validates():
    token = "my-auth-token"
    url = "https://careloop-woad.vercel.app/api/voice/checkin"
    assert not twilio_signature.valid_signature(token, url, {}, "")


def test_an_empty_auth_token_never_validates():
    url = "https://careloop-woad.vercel.app/api/voice/checkin"
    sig = twilio_signature.compute_signature("real-token", url, {})
    assert not twilio_signature.valid_signature("", url, {}, sig)


def test_matches_twilios_own_published_worked_example():
    token = "1234"
    url = "https://mycompany.com/myapp.php?foo=1&bar=2"
    params = {
        "CallSid": "CA1234567890ABCDE",
        "Caller": "+14158675310",
        "Digits": "1234",
        "From": "+14158675310",
        "To": "+18005551212",
    }
    sig = twilio_signature.compute_signature(token, url, params)
    assert twilio_signature.valid_signature(token, url, params, sig)
