"use client";

import { useState } from "react";
import { trackEvent } from "./TrackingPlaceholders";
import { PremiumCard } from "./ui";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  return (
    <PremiumCard>
      <h2 className="text-2xl font-black text-white">İletişim Formu</h2>
      <form
        className="mt-6 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSent(false);
          const formData = new FormData(event.currentTarget);
          const response = await fetch("/api/leads", {
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
          if (!response.ok) {
            setError("Mesajınız gönderilemedi. Lütfen daha sonra tekrar deneyin veya WhatsApp üzerinden iletişime geçin.");
            return;
          }
          setSent(true);
          trackEvent("contact_form_submitted", { form_name: "İletişim Formu" });
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
            <input name={name} required className="min-h-12 rounded-[8px] border border-white/10 bg-black/30 px-4 text-white focus:ring-2 focus:ring-[#4fa8f0]" />
          </label>
        ))}
        <label className="grid gap-2 text-sm font-semibold text-slate-200">
          Mesajınız
          <textarea name="note" required rows={5} className="rounded-[8px] border border-white/10 bg-black/30 px-4 py-3 text-white focus:ring-2 focus:ring-[#4fa8f0]" />
        </label>
        <button type="submit" className="min-h-12 rounded-full bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] px-6 text-sm font-black text-white">Gönder</button>
        {error && <p className="rounded-[8px] bg-red-500/10 p-4 text-sm text-red-100">{error}</p>}
        {sent && <p className="rounded-[8px] bg-[#2f5bff]/10 p-4 text-sm text-[#a9c9ff]">Mesajınız alındı. HK Dijital ekibi bilgilerinizi inceleyip uygun zamanda dönüş yapacaktır.</p>}
      </form>
    </PremiumCard>
  );
}
