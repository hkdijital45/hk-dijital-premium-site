import { CalendarDays, MessageCircle } from "lucide-react";
import { GoogleMark, MetaMark } from "./PlatformIcons";

/**
 * Replaces the old hero "monitor/screen" raster mockup
 * (public/cinematic/hero-poster.png — a blurry device photo with text baked
 * into the pixels) with a real, crisp HTML/CSS/SVG ad-operations panel: an
 * illustrative product-UI composition, not a screenshot of anything.
 *
 * No fabricated metrics: every number-shaped element here is either a
 * schematic (unlabeled) bar/shape or an explicit "—" placeholder, never a
 * made-up ROAS/CTR/revenue figure. The "Örnek arayüz" disclaimer is real,
 * visible DOM text (not a caption baked into an image), and the little
 * weekly chart intentionally moves up AND down — it illustrates that a
 * channel/time view exists, not a guaranteed growth curve.
 */

const CAMPAIGNS: Array<{ name: string; channel: "google" | "meta"; status: "Yayında" | "Taslak" }> = [
  { name: "Arama kampanyası", channel: "google", status: "Yayında" },
  { name: "Instagram hikaye reklamı", channel: "meta", status: "Yayında" },
  { name: "Yeniden pazarlama listesi", channel: "google", status: "Taslak" }
];

const FUNNEL = [
  { label: "Gösterim", width: "100%" },
  { label: "Tıklama", width: "58%" },
  { label: "Mesaj / Form", width: "30%" },
  { label: "Satış görüşmesi", width: "14%" }
];

// Deliberately non-monotonic bar heights (not a smooth idealized up-curve) —
// this is a schematic "a weekly view exists" illustration, not a performance
// claim or an implied guarantee of continuous growth.
const WEEKLY_BARS = [38, 52, 44, 61, 49, 67];

export function AdOperationsPanel() {
  return (
    <div className="ad-panel relative mx-auto w-full max-w-md rounded-[26px] border p-5 sm:p-6" style={{ borderColor: "var(--mk-dark-border)", background: "var(--mk-dark-surface)" }}>
      <p className="sr-only">
        Şematik bir reklam operasyonu ve analiz paneli örneği: kanal dağılımı, kampanya listesi, dönüşüm hunisi ve
        haftalık performans alanlarını gösterir. Gerçek müşteri verisi veya ölçülmüş sonuç içermez, yalnızca ürün
        arayüzünün nasıl çalıştığını anlatan bir örnektir.
      </p>

      <div aria-hidden="true" className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="ad-panel-pulse absolute inline-flex size-full rounded-full" style={{ background: "var(--mk-accent-bright)" }} />
            <span className="relative inline-flex size-2.5 rounded-full" style={{ background: "var(--mk-accent-bright)" }} />
          </span>
          <span className="text-sm font-black text-white">Reklam Operasyonu Paneli</span>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide" style={{ borderColor: "var(--mk-dark-border)", color: "var(--mk-dark-ink-soft)" }}>
          Örnek arayüz
        </span>
      </div>
      <p aria-hidden="true" className="mt-1 text-[11px] font-semibold" style={{ color: "var(--mk-dark-ink-soft)" }}>
        Örnek arayüz — gerçek müşteri verisi içermez.
      </p>

      <div aria-hidden="true" className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--mk-dark-border)" }}>
          <div className="flex items-center gap-2">
            <GoogleMark className="size-5" />
            <span className="text-xs font-bold text-white">Google Ads</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: "64%", background: "var(--mk-accent-bright)" }} />
          </div>
        </div>
        <div className="rounded-2xl border p-3" style={{ borderColor: "var(--mk-dark-border)" }}>
          <div className="flex items-center gap-2">
            <MetaMark className="size-5" />
            <span className="text-xs font-bold text-white">Meta Ads</span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: "46%", background: "#F5A000" }} />
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="mt-4 grid gap-2">
        {CAMPAIGNS.map((c) => (
          <div key={c.name} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--mk-dark-border)" }}>
            <div className="flex items-center gap-2.5">
              {c.channel === "google" ? <GoogleMark className="size-4 shrink-0" /> : <MetaMark className="size-4 shrink-0" />}
              <span className="text-xs font-bold text-white">{c.name}</span>
            </div>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
              style={c.status === "Yayında"
                ? { background: "rgba(35,217,206,.16)", color: "var(--mk-accent-bright)" }
                : { background: "rgba(245,160,0,.16)", color: "#F5A000" }}
            >
              {c.status}
            </span>
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="mt-5">
        <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--mk-dark-ink-soft)" }}>Dönüşüm akışı</p>
        <div className="mt-2 grid gap-1.5">
          {FUNNEL.map((step) => (
            <div key={step.label} className="flex items-center gap-2.5">
              <span className="w-28 shrink-0 text-[11px] font-bold text-white/80">{step.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: step.width, background: "linear-gradient(90deg, var(--mk-accent-bright), #107C73)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div aria-hidden="true" className="mt-5">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--mk-dark-ink-soft)" }}>
            <CalendarDays size={12} /> Haftalık görünüm
          </p>
          <p className="flex items-center gap-1.5 text-[10px] font-black" style={{ color: "var(--mk-dark-ink-soft)" }}>
            <MessageCircle size={12} /> 4 gönderi planlandı
          </p>
        </div>
        <div className="mt-2.5 flex h-16 items-end gap-2">
          {WEEKLY_BARS.map((height, index) => (
            <div key={index} className="flex-1 rounded-t-md" style={{ height: `${height}%`, background: index === WEEKLY_BARS.length - 1 ? "var(--mk-accent-bright)" : "rgba(255,255,255,.14)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
