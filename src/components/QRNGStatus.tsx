import { useState, useEffect } from "react";
import { Wifi, WifiOff, Activity } from "lucide-react";
import { getQRNGStatus, type EntropySource } from "@/lib/crypto";

const QRNGStatus = () => {
  const [source, setSource] = useState<EntropySource>("software");
  const [fresh, setFresh] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const status = await getQRNGStatus();
      setSource(status.source);
      setFresh(status.fresh);
      setLastUpdate(status.lastUpdate);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const isHardware = source === "hardware" && fresh;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`relative w-3 h-3 rounded-full ${isHardware ? "bg-qrng-active" : "bg-qrng-fallback"}`}>
          <div className={`absolute inset-0 rounded-full animate-pulse-glow ${isHardware ? "bg-qrng-active" : "bg-qrng-fallback"}`} />
        </div>
        {isHardware ? (
          <Wifi className="w-4 h-4 text-qrng-active" />
        ) : (
          <WifiOff className="w-4 h-4 text-qrng-fallback" />
        )}
      </div>
      
      <div className="flex flex-col">
        <span className="text-xs font-mono font-bold tracking-wider" style={{ color: isHardware ? 'hsl(var(--qrng-active))' : 'hsl(var(--qrng-fallback))' }}>
          {isHardware ? "QRNG HARDWARE" : "SOFTWARE RNG"}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {isHardware ? "ESP32 Entropy Active" : "Crypto.getRandomValues Fallback"}
        </span>
      </div>

      <Activity className="w-4 h-4 text-muted-foreground ml-auto" />
    </div>
  );
};

export default QRNGStatus;
