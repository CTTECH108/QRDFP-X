import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CyberPanel } from "@/components/CyberPanel";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "register") {
        if (!username.trim()) { setError("Username required"); return; }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setInfo("REGISTRATION SUCCESSFUL. Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated scan line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="scan-anim absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-20" />
      </div>

      {/* Background hex pattern decoration */}
      <div className="absolute inset-0 flex items-center justify-center opacity-3 pointer-events-none select-none overflow-hidden">
        <div className="font-mono-cyber text-cyber-cyan text-[8px] leading-4 opacity-10 tracking-wider break-all max-w-screen-xl">
          {Array(200).fill("0x").join(" A3 F7 2B 9C 1E 84 D5 60 ")}
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 border-2 border-cyber-cyan rounded-sm flex items-center justify-center glow-cyan">
              <span className="font-cyber text-cyber-cyan text-lg font-black">Q</span>
            </div>
            <div>
              <h1 className="font-cyber text-cyber-cyan text-xl tracking-widest leading-none">
                QRNG<span className="text-foreground opacity-60">-COMM</span>
              </h1>
              <p className="font-mono-cyber text-muted-foreground text-[10px] tracking-widest mt-0.5">
                QUANTUM SECURE CHANNEL
              </p>
            </div>
          </div>
        </div>

        <CyberPanel title={mode === "login" ? "AUTHENTICATE" : "REGISTER AGENT"} glow>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-px mb-6">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); setInfo(null); }}
                  className={`flex-1 py-2 font-cyber text-xs tracking-widest uppercase transition-all ${
                    mode === m
                      ? "bg-cyber-cyan text-cyber-dark"
                      : "bg-cyber-surface-2 text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  {m === "login" ? "LOGIN" : "REGISTER"}
                </button>
              ))}
            </div>

            {mode === "register" && (
              <div className="space-y-1">
                <label className="font-mono-cyber text-[10px] text-muted-foreground tracking-widest uppercase">
                  Agent ID / Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="agent_001"
                  className="w-full bg-cyber-surface-2 border border-border text-foreground font-mono-cyber text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan placeholder:text-muted-foreground/50 transition-colors"
                  required
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="font-mono-cyber text-[10px] text-muted-foreground tracking-widest uppercase">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@secure.net"
                className="w-full bg-cyber-surface-2 border border-border text-foreground font-mono-cyber text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan placeholder:text-muted-foreground/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono-cyber text-[10px] text-muted-foreground tracking-widest uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                minLength={8}
                className="w-full bg-cyber-surface-2 border border-border text-foreground font-mono-cyber text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-cyber-cyan focus:ring-1 focus:ring-cyber-cyan placeholder:text-muted-foreground/50 transition-colors"
                required
              />
              {mode === "register" && (
                <p className="font-mono-cyber text-[9px] text-muted-foreground mt-1">
                  MIN 8 CHARS. PASSWORDS ARE HASHED VIA BCRYPT.
                </p>
              )}
            </div>

            {error && (
              <div className="border border-destructive bg-destructive/10 px-3 py-2 rounded-sm">
                <p className="font-mono-cyber text-xs text-cyber-red">⚠ {error.toUpperCase()}</p>
              </div>
            )}

            {info && (
              <div className="border border-cyber-green bg-cyber-green/10 px-3 py-2 rounded-sm">
                <p className="font-mono-cyber text-xs text-cyber-green">✓ {info}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 font-cyber text-sm tracking-widest uppercase bg-cyber-cyan text-cyber-dark hover:bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-sm glow-cyan"
            >
              {loading ? "PROCESSING..." : mode === "login" ? "ACCESS SYSTEM" : "CREATE ACCOUNT"}
            </button>

            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 h-px bg-border" />
              <span className="font-mono-cyber text-[9px] text-muted-foreground tracking-widest">
                AES-256-GCM · HKDF · QRNG
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </form>
        </CyberPanel>

        <p className="text-center font-mono-cyber text-[9px] text-muted-foreground mt-4 tracking-wider">
          ALL TRANSMISSIONS END-TO-END ENCRYPTED IN BROWSER
        </p>
      </div>
    </div>
  );
}
