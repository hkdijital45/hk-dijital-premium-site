"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Download, Plus, RefreshCw, Sparkles, Trash2, XCircle, Zap
} from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import {
  questionCategoryLabels, DEFAULT_QUESTION_COUNT, MAX_QUESTION_COUNT,
  type GeminiVisibilityAnswer, type GeminiVisibilityProfile, type GeminiVisibilityQuestion,
  type GeminiVisibilityQuestionCategory, type GeminiVisibilityScan
} from "@/lib/gemini-visibility/types";

type Company = { id: string; name: string };
type Quota = { customerUsed: number; customerLimit: number; customerRemaining: number; globalUsed: number; globalLimit: number; globalRemaining: number; exceeded: boolean };
type Suggestion = { question: string; category: string };

const inputStyle = { border: "1px solid var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" } as const;

const levelLabels: Record<string, string> = { critical: "Kritik", weak: "Zayıf", developing: "Gelişiyor", strong: "Güçlü", excellent: "Mükemmel" };
const statusLabels: Record<string, string> = { running: "Çalışıyor", completed: "Tamamlandı", partial: "Kısmi", failed: "Başarısız" };
const statusTone: Record<string, AdminStatusTone> = { running: "info", completed: "success", partial: "warning", failed: "danger" };

function scoreTone(score: number): AdminStatusTone {
  if (score >= 70) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) throw new Error(payload?.error || `İstek başarısız (${response.status}).`);
  return payload as T;
}

export function GeminiVisibilityPanel({ geminiConfigured }: { geminiConfigured: boolean }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");

  const [profile, setProfile] = useState<GeminiVisibilityProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({ businessName: "", alternateNames: "", sector: "", city: "", district: "", website: "", serviceSummary: "" });
  const [profileSaving, setProfileSaving] = useState(false);

  const [questions, setQuestions] = useState<GeminiVisibilityQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionCategory, setNewQuestionCategory] = useState<GeminiVisibilityQuestionCategory>("discovery");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const [quota, setQuota] = useState<Quota | null>(null);
  const [scans, setScans] = useState<GeminiVisibilityScan[]>([]);
  const [scansLoading, setScansLoading] = useState(false);
  const [openScanId, setOpenScanId] = useState<string | null>(null);
  const [scanAnswers, setScanAnswers] = useState<GeminiVisibilityAnswer[]>([]);

  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ companies: Company[] }>("/api/admin/companies")
      .then((data) => { if (!cancelled) setCompanies(data.companies || []); })
      .catch(() => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, []);

  function resetForCompany() {
    setProfile(null);
    setQuestions([]);
    setQuota(null);
    setScans([]);
    setOpenScanId(null);
    setScanAnswers([]);
    setSuggestions([]);
  }

  function loadProfile(id: string) {
    setProfileLoading(true);
    fetchJson<{ profile: GeminiVisibilityProfile | null }>(`/api/admin/growth-intelligence/gemini-visibility/profile?companyId=${encodeURIComponent(id)}`)
      .then((data) => {
        setProfile(data.profile);
        if (data.profile) {
          setProfileForm({
            businessName: data.profile.business_name, alternateNames: data.profile.alternate_names.join(", "),
            sector: data.profile.sector || "", city: data.profile.city || "", district: data.profile.district || "",
            website: data.profile.website || "", serviceSummary: data.profile.service_summary || ""
          });
          loadQuestions(data.profile.id);
          loadScans(data.profile.id);
        } else {
          const company = companies.find((item) => item.id === id);
          setProfileForm({ businessName: company?.name || "", alternateNames: "", sector: "", city: "", district: "", website: "", serviceSummary: "" });
        }
        return fetchJson<{ quota: Quota }>(`/api/admin/growth-intelligence/gemini-visibility/quota?companyId=${encodeURIComponent(id)}`);
      })
      .then((data) => setQuota(data.quota))
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Profil yüklenemedi."))
      .finally(() => setProfileLoading(false));
  }

  function loadQuestions(profileId: string) {
    setQuestionsLoading(true);
    fetchJson<{ questions: GeminiVisibilityQuestion[] }>(`/api/admin/growth-intelligence/gemini-visibility/questions?profileId=${encodeURIComponent(profileId)}`)
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setQuestions([]))
      .finally(() => setQuestionsLoading(false));
  }

  function loadScans(profileId: string) {
    setScansLoading(true);
    fetchJson<{ scans: GeminiVisibilityScan[] }>(`/api/admin/growth-intelligence/gemini-visibility/scan?profileId=${encodeURIComponent(profileId)}`)
      .then((data) => setScans(data.scans || []))
      .catch(() => setScans([]))
      .finally(() => setScansLoading(false));
  }

  function onSelectCompany(id: string) {
    setCompanyId(id);
    resetForCompany();
    if (id) loadProfile(id);
  }

  function saveProfile() {
    if (!companyId || !profileForm.businessName.trim()) { setFeedback("İşletme adı zorunludur."); return; }
    setProfileSaving(true);
    fetchJson<{ profile: GeminiVisibilityProfile }>("/api/admin/growth-intelligence/gemini-visibility/profile", {
      method: "PUT",
      body: JSON.stringify({
        companyId, businessName: profileForm.businessName,
        alternateNames: profileForm.alternateNames.split(",").map((name) => name.trim()).filter(Boolean),
        sector: profileForm.sector, city: profileForm.city, district: profileForm.district,
        website: profileForm.website, serviceSummary: profileForm.serviceSummary
      })
    })
      .then((data) => { setProfile(data.profile); setFeedback("Profil kaydedildi."); loadQuestions(data.profile.id); loadScans(data.profile.id); })
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Profil kaydedilemedi."))
      .finally(() => setProfileSaving(false));
  }

  function addQuestion(text: string, category: GeminiVisibilityQuestionCategory, source: "manual" | "ai_suggested" = "manual") {
    if (!profile) return Promise.resolve();
    return fetchJson<{ question: GeminiVisibilityQuestion }>("/api/admin/growth-intelligence/gemini-visibility/questions", {
      method: "POST", body: JSON.stringify({ profileId: profile.id, questionText: text, category, source })
    }).then(() => loadQuestions(profile.id));
  }

  function submitNewQuestion() {
    if (!newQuestionText.trim()) return;
    setBusy("add-question");
    addQuestion(newQuestionText, newQuestionCategory)
      .then(() => setNewQuestionText(""))
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Soru eklenemedi."))
      .finally(() => setBusy(""));
  }

  function toggleQuestion(question: GeminiVisibilityQuestion) {
    setBusy(`toggle-${question.id}`);
    fetchJson("/api/admin/growth-intelligence/gemini-visibility/questions", {
      method: "PATCH", body: JSON.stringify({ id: question.id, isActive: !question.is_active })
    }).then(() => profile && loadQuestions(profile.id)).catch((error) => setFeedback(error instanceof Error ? error.message : "Güncellenemedi.")).finally(() => setBusy(""));
  }

  function deleteQuestion(question: GeminiVisibilityQuestion) {
    setBusy(`delete-${question.id}`);
    fetchJson(`/api/admin/growth-intelligence/gemini-visibility/questions?id=${encodeURIComponent(question.id)}`, { method: "DELETE" })
      .then(() => profile && loadQuestions(profile.id)).catch((error) => setFeedback(error instanceof Error ? error.message : "Silinemedi.")).finally(() => setBusy(""));
  }

  function suggestQuestions() {
    if (!profile) return;
    setBusy("suggest");
    fetchJson<{ suggestions: Suggestion[] }>("/api/admin/growth-intelligence/gemini-visibility/questions/suggest", {
      method: "POST", body: JSON.stringify({ profileId: profile.id })
    }).then((data) => setSuggestions(data.suggestions || [])).catch((error) => setFeedback(error instanceof Error ? error.message : "Öneri alınamadı.")).finally(() => setBusy(""));
  }

  function startScan(forceRefresh = false) {
    if (!profile) return;
    setBusy(forceRefresh ? "scan-force" : "scan");
    setFeedback("Tarama başlatıldı — birkaç Gemini isteği tamamlanana kadar sürebilir...");
    fetchJson<{ scan: GeminiVisibilityScan }>("/api/admin/growth-intelligence/gemini-visibility/scan", {
      method: "POST", body: JSON.stringify({ profileId: profile.id, forceRefresh })
    })
      .then((data) => {
        setFeedback(`Tarama tamamlandı: ${statusLabels[data.scan.status]} — Skor ${data.scan.score ?? "-"}/100.`);
        loadScans(profile.id);
        fetchJson<{ quota: Quota }>(`/api/admin/growth-intelligence/gemini-visibility/quota?companyId=${encodeURIComponent(companyId)}`).then((quotaData) => setQuota(quotaData.quota)).catch(() => null);
      })
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Tarama başarısız oldu."))
      .finally(() => setBusy(""));
  }

  function toggleScanDetail(scan: GeminiVisibilityScan) {
    if (openScanId === scan.id) { setOpenScanId(null); setScanAnswers([]); return; }
    setOpenScanId(scan.id);
    fetchJson<{ answers: GeminiVisibilityAnswer[] }>(`/api/admin/growth-intelligence/gemini-visibility/scan/${scan.id}`)
      .then((data) => setScanAnswers(data.answers || []))
      .catch(() => setScanAnswers([]));
  }

  function convertToTask(scan: GeminiVisibilityScan) {
    setBusy(`task-${scan.id}`);
    fetchJson<{ taskId: string; alreadyExisted: boolean }>("/api/admin/growth-intelligence/gemini-visibility/convert-task", {
      method: "POST",
      body: JSON.stringify({
        scanId: scan.id,
        title: `Görünürlük skorunu iyileştir (${scan.score ?? "-"}/100)`,
        rationale: `AI Görünürlük taraması ${scan.score_level ? levelLabels[scan.score_level] : "-"} seviyesinde sonuçlandı.`
      })
    })
      .then((data) => setFeedback(data.alreadyExisted ? "Bu öneri için görev zaten mevcut." : "Görev oluşturuldu."))
      .catch((error) => setFeedback(error instanceof Error ? error.message : "Görev oluşturulamadı."))
      .finally(() => setBusy(""));
  }

  const activeQuestionCount = useMemo(() => questions.filter((question) => question.is_active).length, [questions]);
  const latestScan = scans[0];
  const trend = useMemo(() => [...scans].reverse().filter((scan) => scan.score != null), [scans]);

  if (!geminiConfigured) {
    return <AdminErrorState title="Gemini API yapılandırılmadı" description="GEMINI_API_KEY (veya GOOGLE_API_KEY) ortam değişkeni ayarlanmadan AI Görünürlük Merkezi çalışamaz. Google AI Pro veya öğrenci Gemini aboneliği bu API'ye erişim sağlamaz — gerçek bir Gemini API anahtarı gerekir." />;
  }

  return (
    <div className="grid gap-5">
      <div className="admin-card rounded-[16px] p-4">
        <label className="text-xs font-black uppercase tracking-wide opacity-60">Müşteri Seçin</label>
        <select className="mt-1 w-full max-w-md rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={companyId} onChange={(event) => onSelectCompany(event.target.value)}>
          <option value="">Müşteri seçin...</option>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
      </div>

      {feedback && <div className="admin-card-soft rounded-[12px] p-3 text-sm font-bold">{feedback}</div>}

      {!companyId ? (
        <AdminEmptyState title="Müşteri seçilmedi" description="AI görünürlük profilini görmek için yukarıdan bir müşteri seçin." />
      ) : profileLoading ? <AdminLoadingState /> : (
        <>
          <div className="admin-card grid gap-4 rounded-[20px] p-5">
            <p className="text-xs font-black uppercase tracking-wide opacity-60">İşletme Profili</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-bold opacity-70">İşletme Adı
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.businessName} onChange={(event) => setProfileForm({ ...profileForm, businessName: event.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-bold opacity-70">Alternatif Adlar (virgülle ayırın)
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.alternateNames} onChange={(event) => setProfileForm({ ...profileForm, alternateNames: event.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-bold opacity-70">Sektör
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.sector} onChange={(event) => setProfileForm({ ...profileForm, sector: event.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-bold opacity-70">Website
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.website} onChange={(event) => setProfileForm({ ...profileForm, website: event.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-bold opacity-70">Şehir
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.city} onChange={(event) => setProfileForm({ ...profileForm, city: event.target.value })} />
              </label>
              <label className="grid gap-1 text-xs font-bold opacity-70">İlçe
                <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.district} onChange={(event) => setProfileForm({ ...profileForm, district: event.target.value })} />
              </label>
            </div>
            <label className="grid gap-1 text-xs font-bold opacity-70">Herkese Açık Hizmet Bilgisi
              <textarea rows={2} className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={profileForm.serviceSummary} onChange={(event) => setProfileForm({ ...profileForm, serviceSummary: event.target.value })} />
            </label>
            <div><AdminButton variant="primary" loading={profileSaving} onClick={saveProfile}>Profili Kaydet</AdminButton></div>
          </div>

          {profile && (
            <>
              {quota && (
                <div className="admin-card flex flex-wrap items-center gap-4 rounded-[16px] p-4 text-sm">
                  <span className="font-black">Kota:</span>
                  <span>Müşteri: {quota.customerUsed}/{quota.customerLimit}</span>
                  <span>Genel: {quota.globalUsed}/{quota.globalLimit}</span>
                  {quota.exceeded && <AdminStatusBadge tone="danger">Kota doldu</AdminStatusBadge>}
                </div>
              )}

              <div className="admin-card grid gap-4 rounded-[20px] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wide opacity-60">Sorular ({activeQuestionCount} aktif / en fazla {MAX_QUESTION_COUNT}, varsayılan {DEFAULT_QUESTION_COUNT})</p>
                  <AdminButton compact variant="ai" icon={<Sparkles size={14} />} loading={busy === "suggest"} onClick={suggestQuestions}>Gemini ile Soru Öner</AdminButton>
                </div>

                {questionsLoading ? <AdminLoadingState /> : (
                  <div className="grid gap-2">
                    {questions.map((question) => (
                      <div key={question.id} className="flex items-center justify-between gap-3 rounded-[10px] p-2" style={{ border: "1px solid var(--admin-border)" }}>
                        <div>
                          <p className="text-sm font-bold">{question.question_text}</p>
                          <span className="text-xs opacity-60">{questionCategoryLabels[question.category]}{question.source === "ai_suggested" ? " · AI önerisi" : ""}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AdminStatusBadge tone={question.is_active ? "success" : "neutral"}>{question.is_active ? "Aktif" : "Pasif"}</AdminStatusBadge>
                          <AdminButton compact variant="ghost" loading={busy === `toggle-${question.id}`} onClick={() => toggleQuestion(question)}>{question.is_active ? "Pasifleştir" : "Aktifleştir"}</AdminButton>
                          <AdminButton compact variant="ghost" icon={<Trash2 size={14} />} loading={busy === `delete-${question.id}`} onClick={() => deleteQuestion(question)} aria-label="Soruyu sil" />
                        </div>
                      </div>
                    ))}
                    {!questions.length && <p className="text-sm opacity-60">Henüz soru eklenmedi.</p>}
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="grid gap-2 rounded-[10px] p-3" style={{ border: "1px dashed var(--admin-border-strong)" }}>
                    <p className="text-xs font-black uppercase opacity-60">Gemini Önerileri</p>
                    {suggestions.map((suggestion, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 text-sm">
                        <span>{suggestion.question} <span className="opacity-50">({questionCategoryLabels[suggestion.category as GeminiVisibilityQuestionCategory] || suggestion.category})</span></span>
                        <AdminButton compact variant="secondary" icon={<Plus size={14} />} onClick={() => { addQuestion(suggestion.question, suggestion.category as GeminiVisibilityQuestionCategory, "ai_suggested"); setSuggestions((prev) => prev.filter((_, itemIndex) => itemIndex !== index)); }}>Ekle</AdminButton>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid flex-1 gap-1 text-xs font-bold opacity-70">Yeni Soru
                    <input className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={newQuestionText} onChange={(event) => setNewQuestionText(event.target.value)} placeholder="Ör: Bu bölgede güvenilir implant tedavisi yapan klinikler hangileri?" />
                  </label>
                  <label className="grid gap-1 text-xs font-bold opacity-70">Kategori
                    <select className="rounded-[10px] px-3 py-2 text-sm font-bold outline-none" style={inputStyle} value={newQuestionCategory} onChange={(event) => setNewQuestionCategory(event.target.value as GeminiVisibilityQuestionCategory)}>
                      {Object.entries(questionCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <AdminButton variant="primary" icon={<Plus size={14} />} loading={busy === "add-question"} onClick={submitNewQuestion}>Ekle</AdminButton>
                </div>
              </div>

              <div className="admin-card grid gap-4 rounded-[20px] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide opacity-60">AI Görünürlük Skoru</p>
                  <div className="flex gap-2">
                    <AdminButton variant="primary" icon={<Zap size={14} />} loading={busy === "scan"} disabled={!activeQuestionCount} onClick={() => startScan(false)}>Taramayı Başlat</AdminButton>
                    <AdminButton variant="secondary" icon={<RefreshCw size={14} />} loading={busy === "scan-force"} disabled={!activeQuestionCount} onClick={() => startScan(true)}>Yeniden Zorla</AdminButton>
                  </div>
                </div>

                {latestScan ? (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-3xl font-black">{latestScan.score ?? "-"}/100</span>
                      <AdminStatusBadge tone={latestScan.score != null ? scoreTone(latestScan.score) : "neutral"}>{latestScan.score_level ? levelLabels[latestScan.score_level] : "-"}</AdminStatusBadge>
                      <AdminStatusBadge tone={statusTone[latestScan.status]}>{statusLabels[latestScan.status]}</AdminStatusBadge>
                      {latestScan.score_change != null && (
                        <span className="text-sm font-bold" style={{ color: latestScan.score_change >= 0 ? "#16a34a" : "#dc2626" }}>
                          {latestScan.score_change >= 0 ? "+" : ""}{latestScan.score_change} önceki taramaya göre
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-70">
                      Gemini tarafından ölçüldü · Model: {latestScan.model} · Tarama tarihi: {new Date(latestScan.started_at).toLocaleString("tr-TR")} · Soru sayısı: {latestScan.questions_total} (tamamlanan {latestScan.questions_completed}, başarısız {latestScan.questions_failed})
                    </p>
                    {latestScan.error && <p className="text-xs text-amber-600">{latestScan.error}</p>}
                    {latestScan.unmeasured_components.length > 0 && (
                      <p className="text-xs opacity-60">Ölçülemeyen bileşenler (yeniden ağırlıklandırıldı): {latestScan.unmeasured_components.join(", ")}</p>
                    )}
                    <details className="text-xs opacity-80">
                      <summary className="cursor-pointer font-bold">Bu skor nasıl hesaplandı?</summary>
                      <div className="mt-2 grid gap-1">
                        {Object.entries(latestScan.score_breakdown).map(([key, value]) => <div key={key}>{key}: {value}/100</div>)}
                        <p className="mt-1">scoring_version: {latestScan.scoring_version} — doğrudan önerilme %35, işletme adı geçme %20, rakip payı %15, kaynak/atıf %10, konum %10, bağlam %10 (ölçülemeyen bileşenler orantılı olarak yeniden ağırlıklandırılır).</p>
                      </div>
                    </details>
                    <div className="flex flex-wrap gap-2">
                      <AdminButton compact variant="secondary" loading={busy === `task-${latestScan.id}`} onClick={() => convertToTask(latestScan)}>Göreve Dönüştür</AdminButton>
                      <a href={`/api/admin/growth-intelligence/gemini-visibility/report/${latestScan.id}?format=pdf`} className="hk-button hk-button-neutral hk-button-compact"><Download size={14} /> PDF Rapor</a>
                      <a href={`/api/admin/growth-intelligence/gemini-visibility/report/${latestScan.id}?format=docx`} className="hk-button hk-button-neutral hk-button-compact"><Download size={14} /> Word Rapor</a>
                    </div>
                  </div>
                ) : <p className="text-sm opacity-60">Henüz tarama yapılmadı — &quot;Taramayı Başlat&quot; ile ilk taramayı çalıştırın.</p>}

                {trend.length > 1 && (
                  <div className="grid gap-1">
                    <p className="text-xs font-black uppercase opacity-60">Skor Trendi</p>
                    <div className="flex items-end gap-1" style={{ height: 60 }}>
                      {trend.map((scan) => (
                        <div key={scan.id} title={`${scan.score}/100`} className="flex-1 rounded-t-[4px]" style={{ height: `${Math.max(4, (scan.score || 0))}%`, background: scan.score! >= 70 ? "#16a34a" : scan.score! >= 50 ? "#d97706" : "#dc2626" }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-card grid gap-3 rounded-[20px] p-5">
                <p className="text-xs font-black uppercase tracking-wide opacity-60">Tarama Geçmişi</p>
                {scansLoading ? <AdminLoadingState /> : !scans.length ? <AdminEmptyState title="Henüz tarama yok" description="Yukarıdan bir tarama başlatın." /> : (
                  <div className="grid gap-2">
                    {scans.map((scan) => (
                      <div key={scan.id} className="rounded-[10px]" style={{ border: "1px solid var(--admin-border)" }}>
                        <button type="button" onClick={() => toggleScanDetail(scan)} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                          <span className="flex items-center gap-2 text-sm font-bold">
                            {new Date(scan.started_at).toLocaleString("tr-TR")}
                            <AdminStatusBadge tone={statusTone[scan.status]}>{statusLabels[scan.status]}</AdminStatusBadge>
                            <AdminStatusBadge tone={scan.score != null ? scoreTone(scan.score) : "neutral"}>{scan.score ?? "-"}/100</AdminStatusBadge>
                            <span className="text-xs opacity-60">{scan.triggered_by === "cron" ? "Otomatik" : "Manuel"}</span>
                          </span>
                          {openScanId === scan.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {openScanId === scan.id && (
                          <div className="grid gap-2 border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
                            {scanAnswers.map((answer) => (
                              <div key={answer.id} className="rounded-[8px] p-2 text-xs" style={{ background: "var(--admin-surface-muted, rgba(0,0,0,0.03))" }}>
                                <p className="font-bold">{answer.question_text_snapshot} <span className="opacity-50">({questionCategoryLabels[answer.category] || answer.category})</span></p>
                                {answer.status === "failed" ? (
                                  <p className="mt-1 flex items-center gap-1 text-red-600"><XCircle size={12} /> {answer.error || "Hata"}</p>
                                ) : (
                                  <>
                                    <p className="mt-1 flex flex-wrap gap-2">
                                      <span className="inline-flex items-center gap-1">{answer.brand_mentioned || answer.alternate_name_mentioned ? <CheckCircle2 size={12} className="text-emerald-600" /> : <AlertTriangle size={12} className="text-amber-600" />} {answer.brand_mentioned || answer.alternate_name_mentioned ? "İşletme geçti" : "İşletme geçmedi"}</span>
                                      {answer.recommended && <span>Doğrudan önerildi</span>}
                                      {answer.position && <span>Konum: {answer.position}</span>}
                                      {answer.sentiment && <span>Bağlam: {answer.sentiment}</span>}
                                      {answer.cached && <span className="opacity-50">(önbellek)</span>}
                                    </p>
                                    {answer.competitors_mentioned.length > 0 && <p className="mt-1 opacity-70">Rakipler: {answer.competitors_mentioned.join(", ")}</p>}
                                    <details className="mt-1"><summary className="cursor-pointer opacity-70">Ham yanıtı gör</summary><p className="mt-1 whitespace-pre-wrap opacity-80">{answer.raw_response}</p></details>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
