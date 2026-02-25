import { useState, useRef } from "react";
import { Upload, File, Lock, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  encryptFile,
  decryptFile,
  type EntropySource,
} from "@/lib/crypto";

interface FileTransferProps {
  userId: string;
  sessionKey: CryptoKey | null;
  entropySource: EntropySource;
  onClose: () => void;
}

interface EncryptedFile {
  id: string;
  sender_id: string;
  file_name: string | null;
  file_size: number | null;
  iv: string;
  entropy_source: string;
  created_at: string;
  encrypted_content: string;
}

const FileTransfer = ({ userId, sessionKey, entropySource, onClose }: FileTransferProps) => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<EncryptedFile[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load encrypted file messages
  useState(() => {
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("message_type", "file")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setFiles(data as EncryptedFile[]);
    };
    load();
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sessionKey) return;

    setUploading(true);
    try {
      const { encryptedBlob, iv, entropySource: src } = await encryptFile(file, sessionKey, entropySource);

      // Upload encrypted blob to storage
      const filePath = `${userId}/${Date.now()}_${file.name}.enc`;
      const { error: uploadError } = await supabase.storage
        .from("encrypted-files")
        .upload(filePath, encryptedBlob);

      if (uploadError) throw uploadError;

      // Store metadata as message
      await supabase.from("messages").insert({
        sender_id: userId,
        encrypted_content: filePath,
        iv,
        entropy_source: src,
        message_type: "file",
        file_name: file.name,
        file_size: file.size,
      });

      // Reload files
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("message_type", "file")
        .order("created_at", { ascending: false })
        .limit(20);
      if (data) setFiles(data as EncryptedFile[]);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: EncryptedFile) => {
    if (!sessionKey) return;
    setDownloadingId(file.id);

    try {
      const { data, error } = await supabase.storage
        .from("encrypted-files")
        .download(file.encrypted_content);

      if (error) throw error;

      const encryptedBuffer = await data.arrayBuffer();
      const decryptedBuffer = await decryptFile(encryptedBuffer, file.iv, sessionKey);

      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name || "decrypted_file";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download/decrypt failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm font-bold text-primary tracking-wider">ENCRYPTED FILE TRANSFER</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Upload area */}
      <div className="p-4">
        <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !sessionKey}
          className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors group"
        >
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
          <p className="text-sm font-mono text-muted-foreground group-hover:text-foreground">
            {uploading ? "Encrypting & Uploading..." : "Drop or click to encrypt & upload"}
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Files are encrypted client-side with AES-256-GCM
          </p>
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {files.length === 0 && (
          <p className="text-center text-muted-foreground font-mono text-sm py-8">
            No encrypted files yet
          </p>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border"
          >
            <File className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-foreground truncate">{file.file_name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-muted-foreground">{formatSize(file.file_size)}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                  file.entropy_source === "hardware"
                    ? "bg-qrng-active/20 text-qrng-active"
                    : "bg-qrng-fallback/20 text-qrng-fallback"
                }`}>
                  {file.entropy_source === "hardware" ? "QRNG" : "SW"}
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(file)}
              disabled={downloadingId === file.id}
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground font-mono text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              {downloadingId === file.id ? "..." : "GET"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileTransfer;
