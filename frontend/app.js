// ================= GSAP FUTURISTIC ENTRANCE =================
gsap.from(".hud", {
  opacity: 0,
  scale: 0.6,
  duration: 1.2,
  ease: "expo.out"
});

// ================= MESSAGE ENCRYPTION =================
async function sendMsg() {
  let msg = document.getElementById("msg").value;

  let r = await fetch("/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      msg: msg,
      nonce: crypto.randomUUID(),
      timestamp: Math.floor(Date.now() / 1000)
    })
  });

  let d = await r.json();

  document.getElementById("msgOut").innerText =
    "Encrypted:\n" + JSON.stringify(d.cipher);
}

// ================= CHUNKED FILE UPLOAD =================
async function uploadFile() {
  let f = document.getElementById("file").files[0];
  let chunkSize = 1024; // 1 KB per chunk
  let fileId = crypto.randomUUID();

  document.getElementById("fileOut").innerText = "Uploading...";

  for (let i = 0, c = 0; i < f.size; i += chunkSize, c++) {
    let chunk = f.slice(i, i + chunkSize);
    let fd = new FormData();

    fd.append("chunk", chunk);
    fd.append("file_id", fileId);
    fd.append("chunk_id", c);
    fd.append("nonce", crypto.randomUUID());
    fd.append("timestamp", Math.floor(Date.now() / 1000));

    await fetch("/upload_chunk", {
      method: "POST",
      body: fd
    });
  }

  document.getElementById("fileOut").innerText =
    "Encrypted upload complete";
}
