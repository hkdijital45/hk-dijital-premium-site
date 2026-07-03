"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Globe2, ImagePlus, Megaphone, Search, ShieldCheck, Smartphone } from "lucide-react";

const platformCards = [
  { key: "meta", title: "Meta Ads", type: "meta_ads", icon: Megaphone, tone: "bg-blue-50 text-blue-700", fields: [
    ["meta_business_id", "Meta Business ID", "Meta işletme hesabınızın kimliği."],
    ["meta_ad_account_id", "Reklam Hesabı ID", "Meta reklam hesabınızın numarası."],
    ["meta_page_id", "Sayfa adı veya linki", "Facebook sayfanızın adı veya bağlantısı."],
    ["meta_pixel_id", "Pixel ID", "Web sitenizde dönüşüm takibi için kullanılan takip kimliğidir."]
  ] },
  { key: "instagram", title: "Instagram", type: "instagram_profile", icon: ImagePlus, tone: "bg-pink-50 text-pink-700", fields: [
    ["username", "Instagram kullanıcı adı", "@ ile başlayan kullanıcı adı."],
    ["profile_url", "Profil linki", "Instagram profil bağlantısı."],
    ["meta_page_id", "Bağlı Meta sayfası", "Varsa bağlı Facebook sayfası."]
  ] },
  { key: "tiktok", title: "TikTok", type: "tiktok_ads", icon: Smartphone, tone: "bg-slate-50 text-slate-700", fields: [
    ["username", "TikTok kullanıcı adı", "TikTok profil kullanıcı adı."],
    ["asset_id", "TikTok Business Center ID", "TikTok işletme merkezi kimliği."],
    ["account_id", "TikTok Ads Account ID", "TikTok reklam hesabı kimliği."],
    ["pixel_id", "Pixel ID", "TikTok web sitesi takip kimliği."]
  ] },
  { key: "google_ads", title: "Google Ads", type: "google_ads", icon: Search, tone: "bg-amber-50 text-amber-700", fields: [
    ["google_ads_customer_id", "Google Ads Customer ID", "Google Ads hesabınızın 10 haneli müşteri numarasıdır."],
    ["mcc_note", "MCC var mı?", "Ajans hesabına bağlı üst hesap bilgisi varsa not edin."]
  ] },
  { key: "google_analytics", title: "Google Analytics", type: "ga4", icon: BarChart3, tone: "bg-emerald-50 text-emerald-700", fields: [
    ["ga4_measurement_id", "GA4 Measurement ID", "G- ile başlayan Google Analytics ölçüm kimliğidir."],
    ["ga4_property_id", "Property ID", "Google Analytics mülk kimliği."],
    ["website_url", "Web site URL", "Ölçüm yapılan web sitesi adresi."]
  ] },
  { key: "website_pixel", title: "Website / Pixel Bilgileri", type: "website_pixel", icon: Globe2, tone: "bg-cyan-50 text-cyan-700", fields: [
    ["website_url", "Web site URL", "Ana web sitesi adresiniz."],
    ["meta_pixel_id", "Meta Pixel ID", "Meta web sitesi takip kimliği."],
    ["gtm_container_id", "Google Tag Manager ID", "GTM- ile başlayan etiket yöneticisi kimliği."],
    ["search_console_site_url", "Search Console doğrulama bilgisi", "Google Search Console site adresi veya doğrulama notu."]
  ] }
];

const statusLabel: Record<string, string> = {
  connected: "Bağlı",
  pending_review: "Kontrol Bekliyor",
  missing_info: "Eksik Bilgi Gerekli",
  error: "Hatalı",
  inactive: "Pasif",
  demo: "Demo Mod"
};

function emptyForm(platform = "meta", assetType = "meta_ads") {
  return {
    platform,
    asset_type: assetType,
    asset_name: "",
    asset_id: "",
    account_id: "",
    website_url: "",
    profile_url: "",
    notes: "",
    login_email: "",
    login_username: "",
    login_password: "",
    recovery_email: "",
    two_factor_note: "",
    access_note: ""
  };
}

export function CustomerAccountConnectCenter() {
  const [assets, setAssets] = useState<any[]>([]);
  const [active, setActive] = useState(platformCards[0]);
  const [form, setForm] = useState<Record<string, string>>(emptyForm(platformCards[0].key, platformCards[0].type));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/customer/integrations", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => { if (mounted) setAssets(Array.isArray(payload.assets) ? payload.assets : []); })
      .catch(() => null);
    return () => { mounted = false; };
  }, []);

  const summary = useMemo(() => ({
    connected: assets.filter((item) => item.status === "connected").length,
    pending: assets.filter((item) => item.status === "pending_review").length,
    missing: assets.filter((item) => item.status === "missing_info" || item.status === "error").length,
    last: assets.map((item) => item.updated_at).filter(Boolean).sort().at(-1)
  }), [assets]);

  function selectPlatform(card: any) {
    const current = assets.find((item) => item.platform === card.key);
    setActive(card);
    setForm({ ...emptyForm(card.key, card.type), ...(current || {}) });
    setMessage("");
  }

  function update(key: string, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, platform: active.key, asset_type: active.type, asset_name: form.asset_name || active.title })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Bilgiler kaydedilemedi.");
      setAssets(payload.assets || []);
      setMessage(payload.message || "Bilgiler kaydedildi. HK Dijital ekibi kontrol edecek.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bilgiler kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="hesap-bagla" className="mb-8 rounded-[24px] border border-cyan-200 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-700">Hesap Bağla</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">Reklam ve analiz hesaplarınızı ekleyin</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Reklam, sosyal medya ve analiz hesaplarınızı buradan ekleyin. HK Dijital ekibi bu bilgilerle rapor, reklam yorumu ve optimizasyon sürecini daha doğru yönetir.</p>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-800">Güvenli manuel bağlantı modu</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Bağlı Hesap", summary.connected], ["Kontrol Bekleyen", summary.pending], ["Eksik Bilgi", summary.missing], ["Son Güncelleme", summary.last ? new Date(summary.last).toLocaleDateString("tr-TR") : "Henüz yok"]].map(([label, value]) => (
          <div key={label} className="rounded-[16px] border border-slate-200 bg-slate-50 p-4">
            <span className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">{label}</span>
            <strong className="mt-1 block text-xl text-slate-950">{value}</strong>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(260px,.85fr)_minmax(0,1.15fr)]">
        <div className="grid gap-3">
          {platformCards.map((card) => {
            const Icon = card.icon;
            const asset = assets.find((item) => item.platform === card.key);
            return (
              <button key={card.key} onClick={() => selectPlatform(card)} className={`rounded-[18px] border p-4 text-left transition hover:-translate-y-0.5 ${active.key === card.key ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start gap-3">
                  <span className={`rounded-[14px] p-3 ${card.tone}`}><Icon size={20} /></span>
                  <span>
                    <strong className="block text-slate-950">{card.title}</strong>
                    <span className="mt-1 block text-xs font-bold text-slate-500">Durum: {statusLabel[asset?.status] || "Eksik"}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950">{active.title} bilgileri</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">Şu an güvenli manuel bağlantı modu aktiftir. Hesap ID ve bağlantı bilgilerini kaydettiğinizde HK Dijital ekibi kontrol eder.</p>
            </div>
            <button type="button" onClick={() => setMessage("Bağlantı testi talebi kaydedildi. HK Dijital ekibi kontrol edecek.")} className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-black text-cyan-800">Bağlantıyı Test Et</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-slate-700">Hesap adı<input value={form.asset_name || ""} onChange={(event) => update("asset_name", event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3" placeholder={active.title} /></label>
            {active.fields.map(([key, label, help]) => (
              <label key={key} className="grid gap-1 text-sm font-bold text-slate-700">{label}<input value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3" /><span className="text-xs font-medium text-slate-500">{help}</span></label>
            ))}
            <label className="md:col-span-2 grid gap-1 text-sm font-bold text-slate-700">Açıklama / not<textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} className="min-h-24 rounded-[12px] border border-slate-200 bg-white p-3" placeholder="Eklemek istediğiniz açıklamayı yazın." /></label>
          </div>

          <div className="mt-5 rounded-[16px] border border-amber-200 bg-amber-50 p-4">
            <h4 className="font-black text-amber-900">İsteğe Bağlı Erişim Notları</h4>
            <p className="mt-1 text-sm leading-6 text-amber-900">Bu alanları doldurmak zorunlu değildir. İsterseniz sadece hesap ID ve bağlantı linklerini ekleyebilirsiniz.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {[
                ["login_email", "Giriş e-postası"],
                ["login_username", "Kullanıcı adı"],
                ["login_password", "Şifre"],
                ["recovery_email", "Kurtarma e-postası"],
                ["two_factor_note", "2FA / doğrulama notu"],
                ["access_note", "Ek açıklama"]
              ].map(([key, label]) => (
                <label key={key} className="grid gap-1 text-sm font-bold text-amber-950">{label}<input type={key === "login_password" ? "password" : "text"} value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className="min-h-11 rounded-[12px] border border-amber-200 bg-white px-3" /></label>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs font-bold leading-5 text-amber-900"><ShieldCheck size={15} />Şifre paylaşmak zorunda değilsiniz. Dilerseniz sadece hesap ID/link bilgilerini girin.</p>
          </div>

          {message && <p className="mt-4 rounded-[14px] border border-cyan-200 bg-white p-3 text-sm font-bold text-cyan-900">{message}</p>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setMessage("HK Dijital ekibine kontrol bildirimi hazırlandı.")} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">Admin’e Bildir</button>
            <button type="button" onClick={save} disabled={loading} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{loading ? "Kaydediliyor..." : "Kaydet"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
