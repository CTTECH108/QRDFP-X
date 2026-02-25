import { CyberPanel } from "@/components/CyberPanel";
import { QRNGStatusBadge } from "@/components/QRNGStatusBadge";

export function ESP32Guide({ entropyEndpoint }: { entropyEndpoint: string }) {
  const arduinoCode = `// ESP32 QRNG Entropy Sender
// Send 32 bytes of hardware entropy to the backend every 20s

#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_PASS";
const char* entropyURL = "${entropyEndpoint}";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("WiFi connected");
}

uint8_t readHardwareEntropy(uint8_t* buf, size_t len) {
  // ESP32 hardware RNG via esp_random()
  for (size_t i = 0; i < len; i += 4) {
    uint32_t r = esp_random(); // True HRNG
    memcpy(buf + i, &r, min((size_t)4, len - i));
  }
  return len;
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    uint8_t entropy[32];
    readHardwareEntropy(entropy, 32);
    
    HTTPClient http;
    http.begin(entropyURL);
    http.addHeader("Content-Type", "application/octet-stream");
    int code = http.POST(entropy, 32);
    Serial.printf("Entropy POST status: %d\\n", code);
    http.end();
  }
  delay(20000); // Send every 20s
}`;

  return (
    <CyberPanel title="ESP32 INTEGRATION GUIDE" subtitle="HARDWARE QRNG" cornerAccent>
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <p className="font-mono-cyber text-xs text-muted-foreground">ENTROPY ENDPOINT:</p>
          <div className="bg-cyber-darker border border-border rounded-sm px-3 py-2 flex items-center gap-2">
            <span className="font-mono-cyber text-xs text-cyber-cyan break-all">{entropyEndpoint}</span>
          </div>
          <p className="font-mono-cyber text-[9px] text-muted-foreground">
            POST application/octet-stream — 32 raw bytes — No auth required
          </p>
        </div>

        <div className="space-y-1">
          <p className="font-mono-cyber text-[10px] text-muted-foreground uppercase tracking-widest">Arduino Sketch</p>
          <pre className="bg-cyber-darker border border-border rounded-sm p-3 text-[10px] font-mono-cyber text-cyber-cyan/80 overflow-x-auto whitespace-pre leading-relaxed">
            {arduinoCode}
          </pre>
        </div>

        <div className="border border-cyber-green/30 bg-cyber-green/5 rounded-sm p-3 space-y-1">
          <p className="font-mono-cyber text-[10px] text-cyber-green tracking-widest">SECURITY PROPERTIES</p>
          <ul className="space-y-0.5">
          {[
              "32-byte entropy validated server-side (edge function)",
              "Replay attack prevention via hex deduplication in MongoDB",
              "30-second freshness window enforced server-side",
              "Software CSPRNG fallback when QRNG entropy is stale",
              "Entropy stored in MongoDB Atlas entropy_log collection",
              "Browser derives AES-256-GCM keys via HKDF — never stored",
            ].map((item) => (
              <li key={item} className="font-mono-cyber text-[9px] text-muted-foreground flex items-start gap-1">
                <span className="text-cyber-green mt-px">▸</span> {item}
              </li>
            ))}
          </ul>
        </div>

        <QRNGStatusBadge showSource />
      </div>
    </CyberPanel>
  );
}
