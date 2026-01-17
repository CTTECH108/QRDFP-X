const chatBox = document.getElementById("chat");

// Entrance animation
gsap.from(".chat-container", {
  scale: 0.7,
  opacity: 0,
  duration: 1,
  ease: "expo.out"
});

async function sendMsg() {
  let msg = document.getElementById("msg").value;
  if (!msg) return;

  document.getElementById("msg").value = "";

  await fetch("/send", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      msg,
      nonce: crypto.randomUUID(),
      timestamp: Math.floor(Date.now()/1000)
    })
  });

  addBubble(msg);
}

function addBubble(text) {
  let div = document.createElement("div");
  div.className = "bubble sent";
  div.innerText = text;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Poll messages every 2 seconds
setInterval(async () => {
  let r = await fetch("/fetch");
  let msgs = await r.json();

  chatBox.innerHTML = "";
  msgs.forEach(m => addBubble(m));
}, 2000);
