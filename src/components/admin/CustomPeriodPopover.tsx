"use client";

import { useEffect, useRef, useState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { localDateOnly, parseCustomPeriodLabel, customPeriodLabel, formatCustomPeriodDisplay, validateCustomPeriod } from "@/lib/ad-operations-period";

export function CustomPeriodPopover({ activePeriod, onApply, onClear }: { activePeriod: string; onApply: (label: string) => void; onClear: () => void }) {
  const active = parseCustomPeriodLabel(activePeriod);
  const today = localDateOnly();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "range">(active && active.start !== active.end ? "range" : "single");
  const [start, setStart] = useState(active?.start || today);
  const [end, setEnd] = useState(active?.end || today);
  const containerRef = useRef<HTMLDivElement>(null);
  const checked = validateCustomPeriod(start, mode === "range" ? end : start, today);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) { if (event.key === "Escape") setOpen(false); }
    function handleClick(event: MouseEvent) { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => { document.removeEventListener("keydown", handleKey); document.removeEventListener("mousedown", handleClick); };
  }, [open]);

  function openPanel() {
    setMode(active && active.start !== active.end ? "range" : "single");
    setStart(active?.start || today);
    setEnd(active?.end || today);
    setOpen((current) => !current);
  }

  function apply() {
    if (!checked.ok) return;
    onApply(customPeriodLabel(checked.start, checked.end));
    setOpen(false);
  }

  const buttonText = active ? formatCustomPeriodDisplay(active.start, active.end) : "📅 Özel Tarih";

  return (
    <div ref={containerRef} className="relative inline-block">
      <AdminButton compact variant={active ? "info" : "secondary"} onClick={openPanel} aria-expanded={open} aria-haspopup="dialog">{buttonText}</AdminButton>
      {open && (
        <div role="dialog" aria-label="Özel tarih seçimi" className="absolute right-0 z-40 mt-2 grid w-[300px] max-w-[calc(100vw-32px)] gap-3 rounded-[12px] p-4 shadow-xl" style={{ border: "1px solid var(--admin-border-strong)", background: "var(--admin-card)" }}>
          <div className="grid grid-cols-2 gap-1 rounded-[10px] p-1" style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))" }} role="group" aria-label="Tarih türü">
            <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")} className="rounded-[8px] px-2 py-1.5 text-xs font-black" style={{ background: mode === "single" ? "var(--admin-card)" : "transparent", color: "var(--admin-text-primary)" }}>Tek tarih</button>
            <button type="button" aria-pressed={mode === "range"} onClick={() => setMode("range")} className="rounded-[8px] px-2 py-1.5 text-xs font-black" style={{ background: mode === "range" ? "var(--admin-card)" : "transparent", color: "var(--admin-text-primary)" }}>Tarih aralığı</button>
          </div>
          <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
            {mode === "single" ? "Tarih" : "Başlangıç"}
            <input type="date" max={today} value={start} onChange={(event) => { setStart(event.target.value); if (mode === "single") setEnd(event.target.value); }} className="min-h-10 rounded-[8px] px-3 text-sm" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }} />
          </label>
          {mode === "range" && (
            <label className="grid gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              Bitiş
              <input type="date" min={start} max={today} value={end} onChange={(event) => setEnd(event.target.value)} className="min-h-10 rounded-[8px] px-3 text-sm" style={{ border: "1px solid var(--admin-border)", background: "var(--admin-surface-soft)", color: "var(--admin-text-primary)" }} />
            </label>
          )}
          {!checked.ok && <p role="alert" className="text-xs font-bold" style={{ color: "var(--hk-danger-text, #B42318)" }}>{checked.error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <AdminButton compact variant="secondary" onClick={() => { onClear(); setOpen(false); }}>Temizle</AdminButton>
            <div className="flex gap-2">
              <AdminButton compact variant="secondary" onClick={() => setOpen(false)}>İptal</AdminButton>
              <AdminButton compact variant="primary" disabled={!checked.ok} onClick={apply}>Uygula</AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
