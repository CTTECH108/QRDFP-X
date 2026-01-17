import time

NONCE_STORE = set()
TIME_WINDOW = 30  # seconds

def validate_request(nonce, timestamp):
    now = int(time.time())

    if abs(now - timestamp) > TIME_WINDOW:
        return False

    if nonce in NONCE_STORE:
        return False

    NONCE_STORE.add(nonce)
    if len(NONCE_STORE) > 1000:
        NONCE_STORE.pop()

    return True
