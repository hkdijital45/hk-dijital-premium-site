"use client";

import { useState } from "react";
import { trackEvent } from "./TrackingPlaceholders";
import { MarketingCard } from "./marketing/MarketingUI";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  return (
    <MarketingCard className="p-7">
      <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>İletişim Formu</h2>
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
          <label key={label} className="grid gap-2 text-sm font-semibold" style={{ color: "var(--mk-ink)" }}>
            {label}
            <input name={name} required className="min-h-12 rounded-[10px] border px-4 outline-none transition focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
          </label>
        ))}
        <label className="grid gap-2 text-sm font-semibold" style={{ color: "var(--mk-ink)" }}>
          Mesajınız
          <textarea name="note" required rows={5} className="rounded-[10px] border px-4 py-3 outline-none transition focus:ring-2" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} />
        </label>
        <button type="submit" className="marketing-btn marketing-btn-primary">Gönder</button>
        {error && <p className="rounded-[10px] p-4 text-sm" style={{ background: "rgba(220,38,38,.08)", color: "#b91c1c" }}>{error}</p>}
        {sent && <p className="rounded-[10px] p-4 text-sm" style={{ background: "rgba(124,58,237,.08)", color: "var(--mk-violet)" }}>Mesajınız alındı. HK Dijital ekibi bilgilerinizi inceleyip uygun zamanda dönüş yapacaktır.</p>}
      </form>
    </MarketingCard>
  );
}
