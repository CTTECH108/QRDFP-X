from flask import Flask, request, jsonify
import os, time
from crypto import encrypt_bytes, decrypt_bytes
from replay import validate_request

app = Flask(__name__)
qrng_buffer = []

UPLOAD_DIR = "uploads"
DECRYPT_DIR = "decrypted"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DECRYPT_DIR, exist_ok=True)

# ---------------- QRNG INGEST ----------------
@app.route("/qrng", methods=["POST"])
def qrng():
    qrng_buffer.append(request.json["qrng"])
    if len(qrng_buffer) > 128:
        qrng_buffer.pop(0)
    return "OK"

# ---------------- MESSAGE ENCRYPTION ----------------
@app.route("/message", methods=["POST"])
def message():
    data = request.json
    if not validate_request(data["nonce"], data["timestamp"]):
        return "Replay blocked", 403

    plain = data["msg"].encode()
    cipher = encrypt_bytes(plain, qrng_buffer)
    return jsonify({"cipher": list(cipher)})

@app.route("/message/decrypt", methods=["POST"])
def message_decrypt():
    cipher = bytes(request.json["cipher"])
    plain = decrypt_bytes(cipher, qrng_buffer)
    return jsonify({"msg": plain.decode()})

# ---------------- CHUNKED FILE UPLOAD ----------------
@app.route("/upload_chunk", methods=["POST"])
def upload_chunk():
    nonce = request.form["nonce"]
    timestamp = int(request.form["timestamp"])

    if not validate_request(nonce, timestamp):
        return "Replay blocked", 403

    file_id = request.form["file_id"]
    chunk_id = int(request.form["chunk_id"])
    data = request.files["chunk"].read()

    enc = encrypt_bytes(data, qrng_buffer)

    path = os.path.join(UPLOAD_DIR, f"{file_id}.enc")
    with open(path, "ab") as f:
        f.write(enc)

    return f"Chunk {chunk_id} stored"

# ---------------- FILE DECRYPT ----------------
@app.route("/decrypt_file", methods=["POST"])
def decrypt_file():
    fname = request.json["filename"]
    with open(os.path.join(UPLOAD_DIR, fname), "rb") as f:
        enc = f.read()

    dec = decrypt_bytes(enc, qrng_buffer)
    out = fname.replace(".enc", "")
    with open(os.path.join(DECRYPT_DIR, out), "wb") as f:
        f.write(dec)

    return "File decrypted"

app.run(debug=True)
