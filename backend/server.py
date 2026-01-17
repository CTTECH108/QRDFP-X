from flask import Flask, request, jsonify, send_from_directory
import os, time
from crypto import encrypt_bytes, decrypt_bytes
from replay import validate_request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")

app = Flask(__name__)

qrng_buffer = []
messages = []   # chat history (encrypted)

UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ---------------- FRONTEND ----------------
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/style.css")
def css():
    return send_from_directory(FRONTEND_DIR, "style.css")

@app.route("/app.js")
def js():
    return send_from_directory(FRONTEND_DIR, "app.js")

# ---------------- QRNG INGEST ----------------
@app.route("/qrng", methods=["POST"])
def qrng():
    data = request.get_json(force=True)
    qrng_buffer.append(data["qrng"])
    if len(qrng_buffer) > 128:
        qrng_buffer.pop(0)
    return "OK", 200

# ---------------- SEND MESSAGE ----------------
@app.route("/send", methods=["POST"])
def send_message():
    data = request.get_json(force=True)

    if not validate_request(data["nonce"], data["timestamp"]):
        return "Replay blocked", 403

    plaintext = data["msg"].encode()
    cipher = encrypt_bytes(plaintext, qrng_buffer)

    messages.append({
        "cipher": list(cipher),
        "time": time.time()
    })

    if len(messages) > 50:
        messages.pop(0)

    return "Sent", 200

# ---------------- FETCH MESSAGES ----------------
@app.route("/fetch", methods=["GET"])
def fetch_messages():
    out = []
    for m in messages:
        plain = decrypt_bytes(bytes(m["cipher"]), qrng_buffer)
        out.append(plain.decode(errors="ignore"))
    return jsonify(out)

# ---------------- ENTRY ----------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
