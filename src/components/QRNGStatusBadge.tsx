import { useEffect, useState } from "react";
import { getLatestEntropyStatus } from "@/lib/entropy";

interface QRNGStatusBadgeProps {
  className?: string;
  showSource?: boolean;
}

export function QRNGStatusBadge({ className = "", showSource = true }: QRNGStatusBadgeProps) {
  const [source, setSource] = useState<"hardware" | "software">("software");
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const status = await getLatestEntropyStatus();
      setSource(status.source);
      setLastSeen(status.lastSeen);
      setChecking(false);
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, []);

  const isHardware = source === "hardware";

  return (
    <div className={`flex items-center gap-2 font-mono-cyber text-xs ${className}`}>
      {/* Indicator dot */}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
          checking
            ? "bg-muted-foreground"
            : isHardware
            ? "bg-cyber-green"
            : "bg-cyber-amber"
        }`}
      >
        {!checking && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
              isHardware ? "bg-cyber-green" : "bg-cyber-amber"
            }`}
          />
        )}
      </span>

      {showSource && (
        <span
          className={
            checking
              ? "text-muted-foreground"
              : isHardware
              ? "text-cyber-green"
              : "text-cyber-amber"
          }
        >
          {checking
            ? "CHECKING..."
            : isHardware
            ? "⚡ HW-QRNG ACTIVE"
            : "⚠ SW-RNG FALLBACK"}
        </span>
      )}

      {isHardware && lastSeen && !checking && (
        <span className="text-muted-foreground text-[10px]">
          [{new Date(lastSeen).toLocaleTimeString()}]
        </span>
      )}
    </div>
  );
}
