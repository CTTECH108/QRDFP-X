import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { CyberPanel } from "./CyberPanel";
import { QRNGStatusBadge } from "./QRNGStatusBadge";
import { fetchEntropy } from "@/lib/entropy";
import { encryptFile, decryptFile } from "@/lib/crypto";
import { listFiles, saveFileMeta, type FileRecord } from "@/lib/mongoApi";

interface FileTransferProps {
  roomId: string;
  user: User;
  username: string;
}

export default function FileTransfer({ roomId, user, username }: FileTransferProps) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const data = await listFiles(roomId);
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    }
  }, [roomId]);

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, [loadFiles]);

  const handleUpload = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    setProgress("FETCHING ENTROPY...");
    try {
      const entropy = await fetchEntropy();
      setProgress("ENCRYPTING FILE (AES-256-GCM)...");
      const { encryptedBlob, iv, salt } = await encryptFile(file, entropy.entropy_hex);

      setProgress("UPLOADING ENCRYPTED DATA TO STORAGE...");
      const path = `${roomId}/${Date.now()}_${file.name}.enc`;
      const metaPath = `${path}.meta`;
      const metaBlob = new Blob(
        [JSON.stringify({ salt, entropy_hex: entropy.entropy_hex, original_name: file.name, mime: file.type })],
        { type: "application/json" }
      );

      const [uploadResult] = await Promise.all([
        supabase.storage.from("encrypted-files").upload(path, encryptedBlob),
        supabase.storage.from("encrypted-files").upload(metaPath, metaBlob),
      ]);
      if (uploadResult.error) throw uploadResult.error;

      setProgress("SAVING METADATA TO MONGODB...");
      await saveFileMeta({
        room_id: roomId,
        uploader_id: user.id,
        uploader_name: username,
        original_name: file.name,
        encrypted_path: path,
        iv,
        file_size: file.size,
        entropy_source: entropy.source,
      });

      await loadFiles();
      setProgress("UPLOAD COMPLETE ✓");
      setTimeout(() => setProgress(null), 2000);
    } catch (err) {
      setProgress(`ERROR: ${err instanceof Error ? err.message : "Upload failed"}`);
      setTimeout(() => setProgress(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileRecord: FileRecord) => {
    setDownloadingId(fileRecord.id);
    try {
      const metaPath = `${fileRecord.encrypted_path}.meta`;
      const [encResult, metaResult] = await Promise.all([
        supabase.storage.from("encrypted-files").download(fileRecord.encrypted_path),
        supabase.storage.from("encrypted-files").download(metaPath),
      ]);
      if (encResult.error || !encResult.data) throw encResult.error || new Error("Download failed");
      if (metaResult.error || !metaResult.data) throw new Error("Metadata missing");

      const meta = JSON.parse(await metaResult.data.text());
      const decrypted = await decryptFile(encResult.data, fileRecord.iv, meta.salt, meta.entropy_hex, meta.mime);

      const url = URL.createObjectURL(decrypted);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileRecord.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Decryption failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <CyberPanel title="SECURE FILE TRANSFER" subtitle="AES-256-GCM · MONGODB METADATA" cornerAccent>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          className={`m-4 border-2 border-dashed rounded-sm p-8 text-center transition-all cursor-pointer ${
            dragOver ? "border-cyber-cyan bg-cyber-cyan/5" : "border-border hover:border-cyber-cyan/50 hover:bg-cyber-surface-2"
          }`}
          onClick={() => {
            const inp = document.createElement("input");
            inp.type = "file";
            inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleUpload(f); };
            inp.click();
          }}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="font-cyber text-cyber-cyan text-sm animate-pulse">{progress || "PROCESSING..."}</div>
              <div className="w-full bg-cyber-surface-2 h-1 rounded">
                <div className="bg-cyber-cyan h-1 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ) : (
            <>
              <div className="font-cyber text-muted-foreground text-sm mb-1">DROP FILE TO ENCRYPT & UPLOAD</div>
              <div className="font-mono-cyber text-[10px] text-muted-foreground/60">
                Encrypted client-side · Metadata stored in MongoDB Atlas
              </div>
            </>
          )}
        </div>
        <div className="px-4 pb-2">
          <QRNGStatusBadge showSource />
        </div>
      </CyberPanel>

      <CyberPanel title="ENCRYPTED FILES" subtitle={`${files.length} OBJECTS IN MONGODB`}>
        <div className="divide-y divide-border">
          {files.length === 0 && (
            <div className="px-4 py-6 text-center font-mono-cyber text-xs text-muted-foreground">NO FILES UPLOADED YET</div>
          )}
          {files.map((f) => (
            <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-cyber-surface-2 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-cyber text-xs text-foreground truncate">{f.original_name}</span>
                  <span className={`font-mono-cyber text-[9px] shrink-0 ${f.entropy_source === "hardware" ? "text-cyber-green" : "text-cyber-amber"}`}>
                    [{f.entropy_source === "hardware" ? "HW" : "SW"}]
                  </span>
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="font-mono-cyber text-[9px] text-muted-foreground">{formatBytes(f.file_size)}</span>
                  <span className="font-mono-cyber text-[9px] text-muted-foreground">{f.uploader_name.toUpperCase()}</span>
                  <span className="font-mono-cyber text-[9px] text-muted-foreground">{new Date(f.created_at).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleDownload(f)}
                disabled={downloadingId === f.id}
                className="shrink-0 font-mono-cyber text-[10px] text-cyber-cyan border border-cyber-cyan/30 px-3 py-1 hover:bg-cyber-cyan/10 disabled:opacity-40 transition-all rounded-sm"
              >
                {downloadingId === f.id ? "DECRYPTING..." : "↓ DECRYPT"}
              </button>
            </div>
          ))}
        </div>
      </CyberPanel>
    </div>
  );
}
