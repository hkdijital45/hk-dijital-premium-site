"use client";

import { useState } from "react";
import { trackEvent } from "./TrackingPlaceholders";
import { PremiumCard } from "./ui";

export function ContactForm() {
  const [sent, setSent] = useState(false);

  return (
    <PremiumCard>
      <h1 className="text-2xl font-black text-white">İletişim Formu</h1>
      <form
        className="mt-6 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "contact",
              name: formData.get("name"),
              email: formData.get("email"),
              phone: formData.get("phone"),
              company: formData.get("company"),
              note: formData.get("note")
            })
          });
          setSent(true);
          trackEvent("contact_form_submitted");
          // Replace local JSON submission storage with real backend/API integration here.
        }}
      >
        {[
          ["Ad Soyad", "name"],
          ["E-posta", "email"],
          ["Telefon", "phone"],
          ["Firma Adı", "company"]
        ].map(([label, name]) => (
          <label key={label} className="grid gap-2 text-sm font-semibold text-slate-200">
            {label}
            <input name={name} required className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-cyan-300" />
          </label>
        ))}
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Mesajınız
          <textarea name="note" required rows={5} className="rounded-[8px] border border-white/10 bg-black/30 px-4 py-3 text-white focus:ring-2 focus:ring-cyan-300" />
        </label>
        <button className="min-h-12 rounded-full bg-cyan-300 px-6 text-sm font-black text-slate-950">Gönder</button>
        {sent && <p className="rounded-[8px] bg-cyan-300/10 p-4 text-sm text-cyan-100">Mesajınız alındı. HK Dijital ekibi bilgilerinizi inceleyip uygun zamanda dönüş yapacaktır.</p>}
      </form>
    </PremiumCard>
  );
}
