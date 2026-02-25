import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Lock, UserPlus, LogIn } from "lucide-react";

interface AuthPageProps {
  onAuth: () => void;
}

const AuthPage = ({ onAuth }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
      }
      onAuth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background cyber-grid relative overflow-hidden">
      {/* Scan line effect */}
      <div className="absolute inset-0 scan-line pointer-events-none" />
      
      <div className="w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-2 border-primary glow-green mb-4">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold text-primary text-glow-green tracking-wider">
            QRNG SECURE
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">
            Quantum-Enhanced Communication
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-card border border-border rounded-lg p-6 glow-green">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                isLogin
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <LogIn className="w-4 h-4 inline mr-2" />
              LOGIN
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-mono rounded transition-all ${
                !isLogin
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              REGISTER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label htmlFor="username" className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  Callsign
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Agent_X"
                  className="bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <Label htmlFor="email" className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Secure Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="agent@secure.dev"
                className="bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Passphrase
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="text-destructive text-xs font-mono bg-destructive/10 p-2 rounded border border-destructive/30">
                <Lock className="w-3 h-3 inline mr-1" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-mono font-bold tracking-wider hover:bg-primary/90 glow-green"
            >
              {loading ? "AUTHENTICATING..." : isLogin ? "ACCESS SECURE CHANNEL" : "INITIALIZE AGENT"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">
              <Lock className="w-3 h-3 inline mr-1" />
              End-to-end encrypted • AES-256-GCM
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
