"use client";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { consentSnapshot, subscribeConsent, writeConsent } from "@/lib/tracking-consent";
import { isPublicTrackedPath } from "@/lib/meta-pixel";
export function TrackingConsent() {
  const choice = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "unset");
  const [editing, setEditing] = useState(false);
  const pathname = usePathname();
  if (!pathname || !isPublicTrackedPath(pathname)) return null;
  if (choice !== "unset" && !editing) return <button type="button" onClick={() => setEditing(true)} className="fixed bottom-3 left-3 z-[90] rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow">Çerez tercihleri</button>;
  const choose = (analytics: boolean, marketing: boolean) => { writeConsent({ analytics, marketing }); setEditing(false); };
  return <section aria-label="Çerez tercihleri" className="fixed bottom-0 inset-x-0 z-[100] border-t border-slate-300 bg-white p-5 text-slate-900 shadow-2xl">
    <div className="mx-auto max-w-5xl"><h2 className="text-lg font-bold">Çerez tercihleri</h2>
      <p className="mt-2 text-sm leading-6">Zorunlu çerezler sitenin çalışmasını sağlar. İzninizle ziyaret ve tıklamaları ölçmek için Google Analytics, reklam performansını ölçmek için Meta Pixel kullanırız. Tercihinizi istediğiniz zaman değiştirebilirsiniz. <Link className="underline" href="/gizlilik-politikasi">Gizlilik politikası</Link></p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="rounded-lg border border-slate-400 px-4 py-2 font-semibold" onClick={() => choose(false, false)}>İsteğe bağlı çerezleri reddet</button>
        <button type="button" className="rounded-lg border border-slate-400 px-4 py-2 font-semibold" onClick={() => choose(true, false)}>Yalnızca analitiğe izin ver</button>
        <button type="button" className="rounded-lg border border-slate-400 px-4 py-2 font-semibold" onClick={() => choose(true, true)}>Tümüne izin ver</button>
      </div>
    </div>
  </section>;
}
