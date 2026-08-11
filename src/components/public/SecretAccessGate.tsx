"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

// Site-wide hidden gate for the Secret Access Control Center. Mounted once
// in the root layout so both triggers work from anywhere:
//  - Desktop: Ctrl/Cmd+Shift+H then K (tracked via a short-lived combo
//    buffer, not a literal simultaneous-keydown check, since browsers
//    report one key at a time).
//  - Mobile: Header.tsx's logo dispatches a "hk-secret-access-open"
//    CustomEvent after 5 rapid taps (see Header.tsx) — this component just
//    listens for it, no prop drilling needed between layout and header.
// Nothing here renders any visible UI unless actively triggered.

const DEVICE_ID_KEY = "hk_device_id";

function getOrCreateDeviceId() {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

export function SecretAccessGate() {
  const [open, setOpen] = useState(false);
  const [triggerMethod, setTriggerMethod] = useState("desktop_keyboard");
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const comboRef = useRef<{ ctrl: boolean; shift: boolean; sawH: boolean; sawK: boolean; timer: ReturnType<typeof setTimeout> | null }>({ ctrl: false, shift: false, sawH: false, sawK: false, timer: null });

  useEffect(() => {
    function resetCombo() {
      comboRef.current.sawH = false;
      comboRef.current.sawK = false;
      if (comboRef.current.timer) clearTimeout(comboRef.current.timer);
      comboRef.current.timer = null;
    }
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;

      const modifiersHeld = (event.ctrlKey || event.metaKey) && event.shiftKey;
      if (!modifiersHeld) {
        resetCombo();
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "h") comboRef.current.sawH = true;
      else if (key === "k") comboRef.current.sawK = true;
      else return;

      if (comboRef.current.timer) clearTimeout(comboRef.current.timer);
      comboRef.current.timer = setTimeout(resetCombo, 1500);

      if (comboRef.current.sawH && comboRef.current.sawK) {
        event.preventDefault();
        resetCombo();
        setTriggerMethod("desktop_keyboard");
        setOpen(true);
      }
    }
    function onLogoTaps() {
      setTriggerMethod("mobile_logo_5tap");
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("hk-secret-access-open", onLogoTaps);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("hk-secret-access-open", onLogoTaps);
    };
  }, []);

  async function submit() {
    if (submitting || !secret.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/secret-access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secret.trim(), deviceId: getOrCreateDeviceId(), triggerMethod })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || "Erişim reddedildi.");
        setSubmitting(false);
        return;
      }
      const destination = new URLSearchParams(window.location.search).get("hk_return") || "/digital-center";
      router.push(destination);
      setOpen(false);
      setSecret("");
    } catch {
      setError("Bağlantı hatası. Tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="HK Digital Access"
      className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[24px] border border-white/15 bg-white/[0.06] p-7 text-left shadow-[0_36px_120px_rgba(0,0,0,.5),0_0_90px_rgba(34,211,238,.14)] backdrop-blur-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.2em] text-cyan-100">
          <LockKeyhole size={13} /> HK Digital Access
        </div>
        <p className="mt-4 text-sm font-bold text-slate-300">Authorized Access Only</p>
        <form
          onSubmit={(event) => { event.preventDefault(); submit(); }}
          className="mt-4 grid gap-3"
        >
          <input
            autoFocus
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder="Access Key"
            aria-label="Access Key"
            className="min-h-14 w-full rounded-[14px] border border-white/12 bg-black/35 px-4 text-base tracking-[.3em] text-white outline-none transition placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/35"
          />
          {error && <p role="alert" className="rounded-[8px] bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !secret.trim()}
            className="mt-1 min-h-14 w-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-yellow-300 px-6 text-base font-black text-slate-950 shadow-[0_0_44px_rgba(34,211,238,.25)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Doğrulanıyor..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
