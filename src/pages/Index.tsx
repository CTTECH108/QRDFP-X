import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, LogOut, Terminal, MessageSquare, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import AuthPage from "@/components/AuthPage";
import ChatWindow from "@/components/ChatWindow";
import FileTransfer from "@/components/FileTransfer";
import QRNGStatus from "@/components/QRNGStatus";
import { deriveSessionKey, type EntropySource } from "@/lib/crypto";

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionKey, setSessionKey] = useState<CryptoKey | null>(null);
  const [entropySource, setEntropySource] = useState<EntropySource>("software");
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [username, setUsername] = useState("Agent");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        if (session?.user) {
          // Load profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", session.user.id)
            .single();
          if (profile) setUsername(profile.username);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Derive session key on login
  useEffect(() => {
    if (!user) {
      setSessionKey(null);
      return;
    }

    const init = async () => {
      const result = await deriveSessionKey(user.id);
      setSessionKey(result.key);
      setEntropySource(result.source);
    };
    init();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSessionKey(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background cyber-grid">
        <div className="text-center">
          <Shield className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="font-mono text-muted-foreground text-sm">Initializing secure channel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-background cyber-grid flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-display text-lg font-bold text-primary text-glow-green tracking-wider">
                QRNG SECURE
              </h1>
              <p className="text-[10px] font-mono text-muted-foreground">
                <Terminal className="w-3 h-3 inline mr-1" />
                {username} • Session Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <QRNGStatus />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="border-border text-muted-foreground hover:text-destructive hover:border-destructive font-mono text-xs"
            >
              <LogOut className="w-3 h-3 mr-1" />
              LOGOUT
            </Button>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto flex">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-mono border-b-2 transition-all ${
              activeTab === "chat"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            SECURE CHAT
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-mono border-b-2 transition-all ${
              activeTab === "files"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileUp className="w-4 h-4" />
            FILE TRANSFER
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full">
        {activeTab === "chat" ? (
          <ChatWindow
            userId={user.id}
            sessionKey={sessionKey}
            entropySource={entropySource}
            onRequestFileUpload={() => setActiveTab("files")}
          />
        ) : (
          <FileTransfer
            userId={user.id}
            sessionKey={sessionKey}
            entropySource={entropySource}
            onClose={() => setActiveTab("chat")}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>AES-256-GCM • HKDF-SHA256 • End-to-End Encrypted</span>
          <span>Entropy: {entropySource === "hardware" ? "Hardware QRNG (ESP32)" : "Software RNG (Web Crypto)"}</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
