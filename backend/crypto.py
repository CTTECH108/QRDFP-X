def rol(val, r):
    return ((val << r) | (val >> (8 - r))) & 0xFF

def derive_flow_key(qrng):
    k = 0
    for i, b in enumerate(qrng):
        k ^= rol(b, i % 8)
    return k

def encrypt_bytes(data: bytes, qrng):
    key = derive_flow_key(qrng)
    return bytes([b ^ rol(key, i % 8) for i, b in enumerate(data)])

def decrypt_bytes(data: bytes, qrng):
    return encrypt_bytes(data, qrng)  # symmetric
