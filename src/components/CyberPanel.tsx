import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CyberPanelProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  glow?: boolean;
  cornerAccent?: boolean;
}

export function CyberPanel({
  children,
  className,
  title,
  subtitle,
  glow = false,
  cornerAccent = true,
}: CyberPanelProps) {
  return (
    <div
      className={cn(
        "relative bg-cyber-surface border border-border rounded-sm overflow-hidden",
        glow && "glow-cyan",
        className
      )}
    >
      {/* Top corner accents */}
      {cornerAccent && (
        <>
          <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyber-cyan opacity-80" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyber-cyan opacity-80" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyber-cyan opacity-80" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyber-cyan opacity-80" />
        </>
      )}

      {/* Header */}
      {(title || subtitle) && (
        <div className="px-4 py-2 border-b border-border bg-cyber-surface-2 flex items-center justify-between">
          {title && (
            <span className="font-cyber text-xs tracking-widest text-cyber-cyan uppercase">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="font-mono-cyber text-xs text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      )}

      <div className="relative z-10">{children}</div>
    </div>
  );
}
