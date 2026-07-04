"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CheckSquare2, Globe2, ImagePlus, Megaphone, PlugZap, Search, ShieldCheck, Smartphone } from "lucide-react";

const platformCards = [
  { key: "meta", title: "Meta / Facebook", type: "meta_ads", oauthProvider: "meta", autoLabel: "Meta ile Giriş Yap", typeLabel: "Business Manager, reklam hesabı, sayfa, Instagram ve Pixel seçimi", icon: Megaphone, tone: "bg-blue-50 text-blue-700", fields: [
    ["meta_business_id", "Meta Business ID", "Meta işletme hesabınızın kimliği."],
    ["meta_ad_account_id", "Reklam Hesabı ID", "Meta reklam hesabınızın numarası."],
    ["meta_page_id", "Sayfa adı veya linki", "Facebook sayfanızın adı veya bağlantısı."],
    ["meta_pixel_id", "Pixel ID", "Web sitenizde dönüşüm takibi için kullanılan takip kimliğidir."]
  ] },
  { key: "instagram", title: "Instagram", type: "instagram_profile", oauthProvider: "meta", autoLabel: "Instagram Hesabını Bağla", typeLabel: "Instagram Business hesabı ve bağlı Meta sayfası", icon: ImagePlus, tone: "bg-pink-50 text-pink-700", fields: [
    ["username", "Instagram kullanıcı adı", "@ ile başlayan kullanıcı adı."],
    ["profile_url", "Profil linki", "Instagram profil bağlantısı."],
    ["meta_page_id", "Bağlı Meta sayfası", "Varsa bağlı Facebook sayfası."]
  ] },
  { key: "tiktok", title: "TikTok", type: "tiktok_ads", oauthProvider: "tiktok", autoLabel: "TikTok ile Giriş Yap", typeLabel: "Business Center, Ads Account ve Pixel seçimi", icon: Smartphone, tone: "bg-slate-50 text-slate-700", fields: [
    ["username", "TikTok kullanıcı adı", "TikTok profil kullanıcı adı."],
    ["asset_id", "TikTok Business Center ID", "TikTok işletme merkezi kimliği."],
    ["account_id", "TikTok Ads Account ID", "TikTok reklam hesabı kimliği."],
    ["pixel_id", "Pixel ID", "TikTok web sitesi takip kimliği."]
  ] },
  { key: "google_ads", title: "Google Ads", type: "google_ads", oauthProvider: "google", autoLabel: "Google ile Giriş Yap", typeLabel: "Google Ads müşteri hesabı seçimi", icon: Search, tone: "bg-amber-50 text-amber-700", fields: [
    ["google_ads_customer_id", "Google Ads Customer ID", "Google Ads hesabınızın 10 haneli müşteri numarasıdır."],
    ["mcc_note", "MCC var mı?", "Ajans hesabına bağlı üst hesap bilgisi varsa not edin."]
  ] },
  { key: "google_analytics", title: "Google Analytics", type: "ga4", oauthProvider: "google", autoLabel: "Analytics Hesabını Seç", typeLabel: "GA4 mülkü ve Search Console site seçimi", icon: BarChart3, tone: "bg-emerald-50 text-emerald-700", fields: [
    ["ga4_measurement_id", "GA4 Measurement ID", "G- ile başlayan Google Analytics ölçüm kimliğidir."],
    ["ga4_property_id", "Property ID", "Google Analytics mülk kimliği."],
    ["website_url", "Web site URL", "Ölçüm yapılan web sitesi adresi."]
  ] },
  { key: "website_pixel", title: "Website / Pixel Bilgileri", type: "website_pixel", oauthProvider: "meta", autoLabel: "Pixel Bağlantısını Hazırla", typeLabel: "Website, Pixel, GTM ve Search Console kontrolü", icon: Globe2, tone: "bg-cyan-50 text-cyan-700", fields: [
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

const oauthStatusLabel: Record<string, string> = {
  not_configured: "OAuth env eksik",
  oauth_ready: "OAuth hazır",
  pending: "Bağlantı bekliyor",
  connected: "Otomatik bağlı",
  error: "Bağlantı hatası"
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
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [form, setForm] = useState<Record<string, string>>(emptyForm(platformCards[0].key, platformCards[0].type));
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [oauthInfo, setOauthInfo] = useState<any>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

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
    setMode(current?.connection_mode === "oauth_ready" || current?.connection_mode === "oauth" ? "auto" : "manual");
    setOauthInfo(null);
    setAssetPickerOpen(false);
    setSelectedAssetIds([]);
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
        body: JSON.stringify({ ...form, platform: active.key, asset_type: active.type, asset_name: form.asset_name || active.title, connection_mode: mode === "auto" ? "oauth_ready" : "manual" })
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

  async function startOAuth() {
    setOauthLoading(true);
    setMessage("");
    setOauthInfo(null);
    try {
      const response = await fetch(`/api/customer/integrations/oauth/${active.oauthProvider}/start?platform=${active.key}&assetType=${active.type}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setOauthInfo(payload);
      if (!response.ok) {
        setMessage(payload.message || payload.error || "Bu platform için otomatik bağlantı henüz aktif değil. Manuel bilgi girebilirsiniz.");
        return;
      }
      if (payload.authUrl) {
        setMessage("OAuth hazırlığı tamam. Yeni pencerede platform giriş ekranını açabilirsiniz veya manuel bilgileri kaydedebilirsiniz.");
      } else {
        setMessage(payload.message || "Otomatik bağlantı hazırlığı kaydedildi.");
      }
    } catch {
      setMessage("Otomatik bağlantı hazırlığı kontrol edilemedi. Manuel bilgi girebilirsiniz.");
    } finally {
      setOauthLoading(false);
    }
  }

  async function loadOAuthAssets() {
    setOauthLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/customer/integrations/oauth/${active.oauthProvider}/assets?platform=${active.key}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      setOauthInfo(payload);
      setAssetPickerOpen(true);
      setSelectedAssetIds((payload.assets || []).slice(0, 1).map((item: any) => item.id));
      if (!response.ok) setMessage(payload.message || "Yetkili hesap listesi şu an alınamadı. Manuel giriş kullanabilirsiniz.");
    } catch {
      setMessage("Hesap listesi alınamadı. Manuel giriş kullanabilirsiniz.");
    } finally {
      setOauthLoading(false);
    }
  }

  async function saveSelectedOAuthAssets() {
    const selected = (oauthInfo?.assets || []).filter((item: any) => selectedAssetIds.includes(item.id));
    if (!selected.length) {
      setMessage("Kaydetmek için en az bir hesap seçin.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/customer/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: active.key,
          asset_type: active.type,
          asset_name: selected[0]?.asset_name || selected[0]?.name || active.title,
          asset_id: selected[0]?.asset_id || selected[0]?.id,
          account_id: selected[0]?.account_id || selected[0]?.id,
          connection_mode: "oauth_ready",
          oauth_status: oauthInfo?.configured ? "oauth_ready" : "not_configured",
          oauth_assets: selected,
          notes: "Otomatik bağlantı hazırlık modundan seçildi."
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.supabaseError || payload.error || "Seçilen hesaplar kaydedilemedi.");
      setAssets(payload.assets || []);
      setAssetPickerOpen(false);
      setMessage("Seçilen hesaplar kaydedildi. HK Dijital ekibi kontrol edecek.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seçilen hesaplar kaydedilemedi.");
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
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-800">Manuel + OAuth hazırlık modu</span>
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
                    <span className="mt-1 block text-[11px] font-bold text-slate-400">{asset?.connection_mode === "oauth_ready" ? "Otomatik bağlantı hazırlığı" : "Manuel bilgi"}</span>
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
              <p className="mt-1 text-sm leading-6 text-slate-600">Bağlantı yöntemini seçin. Otomatik bağlantı hazır değilse manuel bilgi girişiyle HK Dijital ekibi kontrol süreci başlar.</p>
            </div>
            <button type="button" onClick={() => setMessage("Bağlantı testi talebi kaydedildi. HK Dijital ekibi kontrol edecek.")} className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-black text-cyan-800">Bağlantıyı Test Et</button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => setMode("auto")} className={`rounded-[16px] border p-4 text-left transition ${mode === "auto" ? "border-cyan-300 bg-white shadow-sm" : "border-slate-200 bg-white/70"}`}>
              <span className="flex items-center gap-2 font-black text-slate-950"><PlugZap size={18} className="text-cyan-700" /> Otomatik Bağlan</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">{active.typeLabel}. OAuth hazırsa platform giriş akışı açılır; değilse hazırlık modu gösterilir.</span>
            </button>
            <button type="button" onClick={() => setMode("manual")} className={`rounded-[16px] border p-4 text-left transition ${mode === "manual" ? "border-cyan-300 bg-white shadow-sm" : "border-slate-200 bg-white/70"}`}>
              <span className="flex items-center gap-2 font-black text-slate-950"><CheckSquare2 size={18} className="text-emerald-700" /> Manuel Bilgi Gir</span>
              <span className="mt-2 block text-sm leading-6 text-slate-600">Hesap ID, profil linki, Pixel, Analytics ve notları güvenli inceleme için kaydedin.</span>
            </button>
          </div>

          {mode === "auto" && (
            <div className="mt-4 rounded-[18px] border border-blue-200 bg-blue-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-blue-950">Otomatik Bağlantı Hazırlığı</h4>
                  <p className="mt-1 text-sm leading-6 text-blue-900">Gerçek OAuth env değerleri tanımlıysa platform giriş URL’i hazırlanır. Eksikse bu alan güvenli hazırlık modunda kalır ve manuel giriş önerilir.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-800">{oauthStatusLabel[oauthInfo?.oauthStatus] || "Kontrol edilmedi"}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={startOAuth} disabled={oauthLoading} className="rounded-full bg-cyan-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{oauthLoading ? "Kontrol ediliyor..." : active.autoLabel}</button>
                <button type="button" onClick={loadOAuthAssets} disabled={oauthLoading} className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-800 disabled:opacity-60">Yetkili Hesapları Listele</button>
                {oauthInfo?.authUrl && <a href={oauthInfo.authUrl} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-800">Platform Girişini Aç</a>}
              </div>
              {oauthInfo?.missingEnv?.length > 0 && <p className="mt-3 rounded-[12px] bg-white p-3 text-sm font-bold text-blue-900">Otomatik bağlantı için eksik env: {oauthInfo.missingEnv.join(", ")}. Manuel bilgi girebilirsiniz.</p>}
            </div>
          )}

          {assetPickerOpen && (
            <div className="mt-4 rounded-[18px] border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-black text-slate-950">Bağlanacak Hesapları Seç</h4>
                  <p className="mt-1 text-sm text-slate-600">OAuth hazır olduğunda gerçek yetkili hesaplar burada listelenir. Şu an env durumuna göre güvenli hazırlık listesi gösterilir.</p>
                </div>
                <button type="button" onClick={saveSelectedOAuthAssets} disabled={loading} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60">Seçilenleri Kaydet</button>
              </div>
              <div className="mt-4 max-h-72 overflow-auto rounded-[14px] border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">Seç</th><th>Hesap Adı</th><th>Platform</th><th>Varlık Türü</th><th>Durum</th><th>Hesap ID</th><th>Son Senkronizasyon</th></tr></thead>
                  <tbody>{(oauthInfo?.assets || []).map((item: any) => <tr key={item.id} className="border-t border-slate-200"><td className="p-3"><input type="checkbox" checked={selectedAssetIds.includes(item.id)} onChange={(event) => setSelectedAssetIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td><td className="font-bold text-slate-900">{item.asset_name || item.name}</td><td>{item.platform || active.title}</td><td>{item.asset_type || active.type}</td><td>{item.status || "OAuth hazırlık"}</td><td>{item.account_id || item.asset_id || item.id}</td><td>{item.last_synced_at ? new Date(item.last_synced_at).toLocaleString("tr-TR") : "Henüz yok"}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {mode === "manual" && <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-slate-700">Hesap adı<input value={form.asset_name || ""} onChange={(event) => update("asset_name", event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3" placeholder={active.title} /></label>
            {active.fields.map(([key, label, help]) => (
              <label key={key} className="grid gap-1 text-sm font-bold text-slate-700">{label}<input value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className="min-h-11 rounded-[12px] border border-slate-200 bg-white px-3" /><span className="text-xs font-medium text-slate-500">{help}</span></label>
            ))}
            <label className="md:col-span-2 grid gap-1 text-sm font-bold text-slate-700">Açıklama / not<textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} className="min-h-24 rounded-[12px] border border-slate-200 bg-white p-3" placeholder="Eklemek istediğiniz açıklamayı yazın." /></label>
          </div>}

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
            <button type="button" onClick={save} disabled={loading} className="rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{loading ? "Kaydediliyor..." : mode === "auto" ? "OAuth Hazırlığını Kaydet" : "Kaydet"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
