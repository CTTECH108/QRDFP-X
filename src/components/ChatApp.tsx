import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { QRNGStatusBadge } from "@/components/QRNGStatusBadge";
import { fetchEntropy } from "@/lib/entropy";
import { encryptMessage, decryptMessage } from "@/lib/crypto";
import {
  listRooms, createRoom, listMessages, sendMessage,
  type Room, type Message,
} from "@/lib/mongoApi";
import FileTransfer from "@/components/FileTransfer";
import { MongoDBBadge } from "@/components/MongoDBBadge";

interface DecodedMessage extends Message {
  plaintext: string;
}

interface ChatAppProps {
  user: User;
}

export default function ChatApp({ user }: ChatAppProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "files">("chat");
  const [username, setUsername] = useState(user.email?.split("@")[0] || "agent");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const lastTimestampRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  // Load username from supabase profile
  useEffect(() => {
    supabase.from("profiles").select("username").eq("id", user.id).single()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [user.id]);

  // Load rooms from MongoDB
  const loadRooms = useCallback(async () => {
    try {
      const data = await listRooms();
      setRooms(data);
    } catch (err) {
      console.error("Failed to load rooms:", err);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Decode a raw message
  const decodeMsg = async (msg: Message): Promise<DecodedMessage> => {
    try {
      const parsed = JSON.parse(msg.encrypted_payload);
      const plaintext = await decryptMessage(parsed.ciphertext, msg.iv, parsed.salt, parsed.entropy_hex);
      return { ...msg, plaintext };
    } catch {
      return { ...msg, plaintext: "[DECRYPTION FAILED]" };
    }
  };

  // Initial load + polling for new messages
  const loadMessages = useCallback(async (roomId: string, initial = false) => {
    if (initial) setLoadingMsgs(true);
    try {
      const since = initial ? undefined : (lastTimestampRef.current ?? undefined);
      const raw = await listMessages(roomId, since);
      if (raw.length === 0) return;

      const decoded = await Promise.all(raw.map(decodeMsg));

      if (initial) {
        setMessages(decoded);
        setTimeout(scrollToBottom, 100);
      } else {
        setMessages((prev) => [...prev, ...decoded]);
        setTimeout(scrollToBottom, 50);
      }

      // Track latest timestamp for next poll
      const latest = raw[raw.length - 1].created_at;
      lastTimestampRef.current = latest;
    } finally {
      if (initial) setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!activeRoom) return;

    lastTimestampRef.current = null;
    setMessages([]);
    loadMessages(activeRoom.id, true);

    // Poll every 2 seconds for new messages
    pollRef.current = setInterval(() => {
      loadMessages(activeRoom.id, false);
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRoom, loadMessages]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeRoom || sending) return;
    setSending(true);
    try {
      const entropy = await fetchEntropy();
      const { ciphertext, iv, salt } = await encryptMessage(inputText.trim(), entropy.entropy_hex);
      const encrypted_payload = JSON.stringify({ ciphertext, salt, entropy_hex: entropy.entropy_hex });

      await sendMessage({
        room_id: activeRoom.id,
        sender_id: user.id,
        sender_name: username,
        encrypted_payload,
        iv,
        entropy_source: entropy.source,
      });
      setInputText("");
    } catch (err) {
      console.error("Send failed:", err);
    } finally {
      setSending(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      const room = await createRoom(newRoomName.trim(), user.id);
      setRooms((prev) => [...prev, room]);
      setActiveRoom(room);
      setNewRoomName("");
      setShowNewRoom(false);
    } catch (err) {
      console.error("Create room failed:", err);
    }
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-border bg-cyber-surface flex items-center justify-between px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border-2 border-cyber-cyan rounded-sm flex items-center justify-center">
            <span className="font-cyber text-cyber-cyan text-sm font-black">Q</span>
          </div>
          <div>
            <span className="font-cyber text-cyber-cyan text-sm tracking-widest">QRNG-COMM</span>
            <span className="font-mono-cyber text-muted-foreground text-[9px] ml-2">v2.0 · MongoDB</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <QRNGStatusBadge />
          <MongoDBBadge />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono-cyber text-xs text-muted-foreground hidden sm:inline">
            {username.toUpperCase()}
          </span>
          <button
            onClick={signOut}
            className="font-mono-cyber text-xs text-cyber-red hover:text-destructive border border-cyber-red/30 px-2 py-1 rounded-sm transition-colors"
          >
            LOGOUT
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: rooms */}
        <aside className="w-52 border-r border-border bg-cyber-surface shrink-0 flex flex-col">
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="font-cyber text-[10px] text-muted-foreground tracking-widest uppercase">Channels</span>
            <button
              onClick={() => setShowNewRoom(!showNewRoom)}
              className="text-cyber-cyan hover:text-primary font-mono-cyber text-sm leading-none"
            >+</button>
          </div>

          {showNewRoom && (
            <div className="px-2 py-2 border-b border-border bg-cyber-surface-2">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                placeholder="channel-name"
                className="w-full bg-cyber-darker border border-border text-foreground font-mono-cyber text-xs px-2 py-1 rounded-sm focus:outline-none focus:border-cyber-cyan placeholder:text-muted-foreground/40"
              />
              <button
                onClick={handleCreateRoom}
                className="mt-1 w-full font-mono-cyber text-[10px] text-cyber-cyan border border-cyber-cyan/30 py-0.5 hover:bg-cyber-cyan/10 transition-colors"
              >
                CREATE
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => { setActiveRoom(room); setActiveTab("chat"); }}
                className={`w-full text-left px-3 py-2 font-mono-cyber text-xs transition-all border-l-2 ${
                  activeRoom?.id === room.id
                    ? "border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-cyber-surface-2"
                }`}
              >
                # {room.name}
              </button>
            ))}
            {rooms.length === 0 && (
              <p className="px-3 py-3 font-mono-cyber text-[10px] text-muted-foreground">
                No channels yet.
              </p>
            )}
          </div>

          {/* DB info */}
          <div className="px-3 py-2 border-t border-border space-y-1">
            <p className="font-mono-cyber text-[8px] text-muted-foreground leading-relaxed">
              AES-256-GCM · HKDF<br />
              BACKEND: MONGODB ATLAS<br />
              E2E ENCRYPTED
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeRoom ? (
            <>
              <div className="border-b border-border bg-cyber-surface px-4 py-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-cyber text-sm text-foreground tracking-wider"># {activeRoom.name}</span>
                    <span className="font-mono-cyber text-[9px] text-muted-foreground ml-2">
                      {activeRoom.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-px">
                    {(["chat", "files"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 font-mono-cyber text-[10px] uppercase tracking-widest transition-all ${
                          activeTab === tab
                            ? "bg-cyber-cyan text-cyber-dark"
                            : "bg-cyber-surface-2 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {activeTab === "chat" ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loadingMsgs && (
                      <div className="flex justify-center">
                        <span className="font-mono-cyber text-xs text-muted-foreground animate-pulse">LOADING ENCRYPTED MESSAGES...</span>
                      </div>
                    )}
                    {!loadingMsgs && messages.length === 0 && (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <p className="font-cyber text-muted-foreground text-sm">CHANNEL SECURE</p>
                          <p className="font-mono-cyber text-[10px] text-muted-foreground/60 mt-1">
                            Messages are encrypted before leaving your device
                          </p>
                        </div>
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isSelf = msg.sender_id === user.id;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
                          <div className="flex items-baseline gap-2 mb-0.5">
                            <span className={`font-mono-cyber text-[10px] ${isSelf ? "text-cyber-cyan" : "text-cyber-green"}`}>
                              {msg.sender_name.toUpperCase()}
                            </span>
                            <span className="font-mono-cyber text-[8px] text-muted-foreground">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </span>
                            <span className={`font-mono-cyber text-[8px] ${
                              msg.entropy_source === "hardware" ? "text-cyber-green" : "text-cyber-amber"
                            }`}>
                              [{msg.entropy_source === "hardware" ? "HW-QRNG" : "SW-RNG"}]
                            </span>
                          </div>
                          <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-sm text-sm font-mono-cyber ${
                            isSelf
                              ? "bg-cyber-cyan/10 border border-cyber-cyan/30 text-foreground"
                              : "bg-cyber-surface-2 border border-border text-foreground"
                          }`}>
                            {msg.plaintext}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t border-border p-3 shrink-0 bg-cyber-surface">
                    <div className="flex gap-2">
                      <input
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                        placeholder="TYPE ENCRYPTED MESSAGE..."
                        className="flex-1 bg-cyber-surface-2 border border-border text-foreground font-mono-cyber text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-cyber-cyan placeholder:text-muted-foreground/40 transition-colors"
                        disabled={sending}
                      />
                      <button
                        onClick={handleSend}
                        disabled={sending || !inputText.trim()}
                        className="px-4 font-cyber text-xs tracking-widest bg-cyber-cyan text-cyber-dark hover:bg-primary disabled:opacity-40 rounded-sm transition-all"
                      >
                        {sending ? "..." : "SEND"}
                      </button>
                    </div>
                    <p className="font-mono-cyber text-[8px] text-muted-foreground mt-1">
                      ENCRYPTED IN BROWSER · AES-256-GCM · STORED IN MONGODB
                    </p>
                  </div>
                </>
              ) : (
                <FileTransfer roomId={activeRoom.id} user={user} username={username} />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-2 border-cyber-cyan/30 rounded-sm flex items-center justify-center mx-auto">
                  <span className="font-cyber text-cyber-cyan/50 text-3xl">Q</span>
                </div>
                <div>
                  <p className="font-cyber text-muted-foreground tracking-widest">SELECT A CHANNEL</p>
                  <p className="font-mono-cyber text-[10px] text-muted-foreground/60 mt-1">
                    Or create a new secure channel
                  </p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <QRNGStatusBadge showSource />
                  <MongoDBBadge />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
