import pytest

import telephony


@pytest.fixture(autouse=True)
def reset_process_call_cap():
    telephony._PROCESS_CALL_COUNT = 0
    yield
    telephony._PROCESS_CALL_COUNT = 0
