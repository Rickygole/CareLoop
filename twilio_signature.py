import base64
import hmac
from hashlib import sha1
from typing import Dict, Iterable
from urllib.parse import urlparse


def _without_port(parsed):
    if not parsed.port:
        return parsed.geturl()
    netloc = parsed.netloc.split(":")[0]
    return parsed._replace(netloc=netloc).geturl()


def _with_port(parsed):
    if parsed.port:
        return parsed.geturl()
    port = 443 if parsed.scheme == "https" else 80
    netloc = parsed.netloc + ":" + str(port)
    return parsed._replace(netloc=netloc).geturl()


def compute_signature(auth_token: str, url: str, params: Dict[str, str]) -> str:
    combined = url
    for name in sorted(set(params)):
        combined += name + str(params[name])
    mac = hmac.new(auth_token.encode("utf-8"), combined.encode("utf-8"), sha1)
    return base64.b64encode(mac.digest()).decode("utf-8")


def _constant_time_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))


def valid_signature(
    auth_token: str, url: str, params: Dict[str, str], signature: str,
) -> bool:
    if not auth_token or not signature:
        return False
    parsed = urlparse(url)
    for candidate_url in (_without_port(parsed), _with_port(parsed)):
        computed = compute_signature(auth_token, candidate_url, params)
        if _constant_time_equal(computed, signature):
            return True
    return False
