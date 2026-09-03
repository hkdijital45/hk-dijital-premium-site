"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const next = raw.trim();
    if (!next) return;
    const exists = value.some((item) => item.toLocaleLowerCase("tr") === next.toLocaleLowerCase("tr"));
    if (!exists) onChange([...value, next]);
    setDraft("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 focus-within:border-cyan-300">
      {value.map((tag, index) => (
        <span key={`${tag}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-cyan-300/15 px-2.5 py-1 text-xs font-bold text-cyan-100">
          {tag}
          <button type="button" aria-label={`${tag} etiketini kaldır`} onClick={() => onChange(value.filter((_, i) => i !== index))} className="text-cyan-200 hover:text-white">
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commit(draft)}
        placeholder={value.length ? "" : placeholder || "Enter veya virgülle ekleyin"}
        className="min-w-[140px] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
      />
    </div>
  );
}
