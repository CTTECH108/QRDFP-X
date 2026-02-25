import { useState, useEffect, useRef } from "react";
import { Send, Lock, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  deriveSessionKey,
  encryptMessage,
  decryptMessage,
  type EntropySource,
  type EncryptedPayload,
} from "@/lib/crypto";

interface Message {
  id: string;
  sender_id: string;
  encrypted_content: string;
  iv: string;
  entropy_source: string;
  message_type: string;
  file_name: string | null;
  created_at: string;
  decrypted?: string;
  senderName?: string;
}

interface ChatWindowProps {
  userId: string;
  sessionKey: CryptoKey | null;
  entropySource: EntropySource;
  onRequestFileUpload: () => void;
}

const ChatWindow = ({ userId, sessionKey, entropySource, onRequestFileUpload }: ChatWindowProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load existing messages
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("message_type", "text")
        .order("created_at", { ascending: true })
        .limit(100);

      if (data) {
        const withNames = await Promise.all(
          data.map(async (msg) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("username")
              .eq("user_id", msg.sender_id)
              .single();

            let decrypted = "[Encrypted]";
            if (sessionKey) {
              try {
                decrypted = await decryptMessage(
                  { ciphertext: msg.encrypted_content, iv: msg.iv, entropySource: msg.entropy_source as EntropySource },
                  sessionKey
                );
              } catch {
                decrypted = "[Cannot decrypt - different session key]";
              }
            }

            return { ...msg, decrypted, senderName: profile?.username || "Unknown" };
          })
        );
        setMessages(withNames);
      }
    };

    loadMessages();
  }, [sessionKey]);

  // Subscribe to realtime messages
  useEffect(() => {
    const channel = supabase
      .channel("messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as Message;
          if (msg.message_type !== "text") return;

          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", msg.sender_id)
            .single();

          let decrypted = "[Encrypted]";
          if (sessionKey) {
            try {
              decrypted = await decryptMessage(
                { ciphertext: msg.encrypted_content, iv: msg.iv, entropySource: msg.entropy_source as EntropySource },
                sessionKey
              );
            } catch {
              decrypted = "[Cannot decrypt - different session key]";
            }
          }

          setMessages((prev) => [...prev, { ...msg, decrypted, senderName: profile?.username || "Unknown" }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionKey]);

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !sessionKey) return;
    setSending(true);

    try {
      const encrypted = await encryptMessage(input, sessionKey, entropySource);

      await supabase.from("messages").insert({
        sender_id: userId,
        encrypted_content: encrypted.ciphertext,
        iv: encrypted.iv,
        entropy_source: encrypted.entropySource,
        message_type: "text",
      });

      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground font-mono text-sm py-20">
            <Lock className="w-8 h-8 mx-auto mb-3 text-primary opacity-50" />
            <p>Secure channel initialized</p>
            <p className="text-xs mt-1">All messages are end-to-end encrypted</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                  isMine
                    ? "bg-primary/20 border border-primary/40"
                    : "bg-secondary border border-border"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold" style={{ color: isMine ? 'hsl(var(--primary))' : 'hsl(var(--neon-cyan))' }}>
                    {isMine ? "You" : msg.senderName}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    msg.entropy_source === "hardware"
                      ? "bg-qrng-active/20 text-qrng-active"
                      : "bg-qrng-fallback/20 text-qrng-fallback"
                  }`}>
                    {msg.entropy_source === "hardware" ? "QRNG" : "SW"}
                  </span>
                </div>
                <p className="text-sm font-mono text-foreground">{msg.decrypted}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border p-4 bg-card">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onRequestFileUpload}
            className="border-border text-muted-foreground hover:text-primary hover:border-primary"
          >
            <FileUp className="w-4 h-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type encrypted message..."
            className="flex-1 bg-input border-border font-mono text-foreground placeholder:text-muted-foreground"
            disabled={!sessionKey}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !sessionKey || !input.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {!sessionKey && (
          <p className="text-xs text-destructive font-mono mt-2">
            Deriving session key... Please wait.
          </p>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
