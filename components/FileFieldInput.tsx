"use client";

import { useRef, useState } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { cn } from "./ui";
import { uploadsApi, API_BASE, ApiError } from "../lib/api";

function fileUrl(u: string) {
  return u.startsWith("http") ? u : API_BASE.replace("/api/v1", "") + u;
}

/** Backs "File"-type custom fields from Form Builder: uploads immediately on selection, storing the returned URL as the field's value. */
export function FileFieldInput({
  value, onChange, className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { data } = await uploadsApi.upload(file);
      setUploadedName(data.fileName);
      onChange(data.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const displayName = uploadedName ?? (value ? decodeURIComponent(value.split("/").pop() ?? "File") : "");

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2 flex-wrap">
        {value ? (
          <a
            href={fileUrl(value)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline truncate max-w-[180px]"
          >
            <Paperclip className="size-3 shrink-0" />
            {displayName}
          </a>
        ) : (
          <span className="text-xs text-muted">No file uploaded</span>
        )}
        <label className={cn(
          "text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-2 cursor-pointer transition-colors shrink-0",
          uploading && "opacity-50 pointer-events-none",
        )}>
          {uploading ? <Loader2 className="size-3 inline animate-spin" /> : value ? "Replace" : "Upload"}
          <input ref={inputRef} type="file" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {value && !uploading && (
          <button
            type="button"
            onClick={() => { setUploadedName(null); onChange(""); }}
            className="text-muted hover:text-danger transition-colors shrink-0"
            title="Remove"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
