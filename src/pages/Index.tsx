import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import AuthPage from "./AuthPage";
import ChatApp from "@/components/ChatApp";

export default function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background cyber-grid flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-cyber-cyan rounded-sm flex items-center justify-center mx-auto animate-pulse glow-cyan">
            <span className="font-cyber text-cyber-cyan text-lg font-black">Q</span>
          </div>
          <p className="font-mono-cyber text-cyber-cyan text-xs tracking-widest animate-pulse">INITIALIZING SECURE CHANNEL...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <ChatApp user={user} />;
}
