from flask import Flask, request, jsonify, send_from_directory
import os, time
from crypto import encrypt_bytes, decrypt_bytes
from replay import validate_request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__)

# ---------------- GLOBAL QRNG BUFFER ----------------
qrng_buffer = []

# ---------------- STORAGE DIRECTORIES ----------------
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DECRYPT_DIR = os.path.join(BASE_DIR, "decrypted")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DECRYPT_DIR, exist_ok=True)

# ====================================================
# FRONTEND SERVING (SINGLE WEB SERVICE)
# ====================================================

@app.route("/", methods=["GET"])
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/style.css")
def serve_css():
    return send_from_directory(FRONTEND_DIR, "style.css")

@app.route("/app.js")
def serve_js():
    return send_from_directory(FRONTEND_DIR, "app.js")

# ====================================================
# HEALTH CHECK
# ====================================================

@app.route("/health")
def health():
    return "OK", 200

# ====================================================
# QRNG INGEST (ESP8266)
# ====================================================

@app.route("/qrng", methods=["POST"])
def qrng():
    data = request.get_json(force=True)
    qrng_buffer.append(data["qrng"])

    if len(qrng_buffer) > 128:
        qrng_buffer.pop(0)

    return "OK", 200

# ====================================================
# MESSAGE ENCRYPTION / DECRYPTION
# ====================================================

@app.route("/message", methods=["POST"])
def message_encrypt():
    data = request.get_json(force=True)

    if not validate_request(data["nonce"], data["timestamp"]):
        return "Replay blocked", 403

    plain = data["msg"].encode()
    cipher = encrypt_bytes(plain, qrng_buffer)

    return jsonify({"cipher": list(cipher)})

@app.route("/message/decrypt", methods=["POST"])
def message_decrypt():
    data = request.get_json(force=True)
    cipher = bytes(data["cipher"])

    plain = decrypt_bytes(cipher, qrng_buffer)
    return jsonify({"msg": plain.decode(errors="ignore")})

# ====================================================
# CHUNKED FILE UPLOAD (ENCRYPTED)
# ====================================================

@app.route("/upload_chunk", methods=["POST"])
def upload_chunk():
    nonce = request.form["nonce"]
    timestamp = int(request.form["timestamp"])

    if not validate_request(nonce, timestamp):
        return "Replay blocked", 403

    file_id = request.form["file_id"]
    chunk_id = int(request.form["chunk_id"])
    chunk_data = request.files["chunk"].read()

    encrypted_chunk = encrypt_bytes(chunk_data, qrng_buffer)

    path = os.path.join(UPLOAD_DIR, f"{file_id}.enc")
    with open(path, "ab") as f:
        f.write(encrypted_chunk)

    return f"Chunk {chunk_id} stored", 200

# ====================================================
# FILE DECRYPT
# ====================================================

@app.route("/decrypt_file", methods=["POST"])
def decrypt_file():
    data = request.get_json(force=True)
    filename = data["filename"]

    enc_path = os.path.join(UPLOAD_DIR, filename)
    with open(enc_path, "rb") as f:
        encrypted_data = f.read()

    decrypted_data = decrypt_bytes(encrypted_data, qrng_buffer)

    output_name = filename.replace(".enc", "")
    out_path = os.path.join(DECRYPT_DIR, output_name)

    with open(out_path, "wb") as f:
        f.write(decrypted_data)

    return "File decrypted", 200

# ====================================================
# ENTRY POINT (RENDER + LOCAL)
# ====================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
