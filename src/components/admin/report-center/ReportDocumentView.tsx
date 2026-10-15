"use client";

// On-screen rendering of a report's real content — the SAME DocumentPayload
// its PDF is built from (Rapor Merkezi V2 "Raporu Görüntüle"), so what the
// user reads here is exactly what the PDF contains. No content is
// generated or summarized client-side.
import type { DocumentChart, DocumentPayload, DocumentSection } from "@/lib/document-model";
import { cellLabel, isDocumentLink } from "@/lib/document-model";
import { formatChartValue, sanitizeChartData } from "@/lib/report-design";
import { forceTextColor } from "@/lib/admin-style";

type ViewerDocument = Omit<DocumentPayload, "clientLogo">;

/** Stored report links are rendered only for web/mail/phone targets. */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    return ["https:", "http:", "mailto:", "tel:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

function isSubsection(section: DocumentSection) {
  if (section.level) return section.level === 2;
  return /\s[—–]\s|\(devam\)\s*$/i.test(section.title);
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p, i) => (
        <p key={i} className="mt-2 whitespace-pre-line text-sm leading-7" style={{ color: "var(--admin-text-primary)" }}>{p}</p>
      ))}
    </>
  );
}

function ChartView({ chart }: { chart: DocumentChart }) {
  const data = sanitizeChartData(chart.data, chart.type);
  if (!data) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <figure className="mt-3 rounded-[12px] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
      <figcaption className="text-sm font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{chart.title}</figcaption>
      <div className="mt-3 grid gap-2">
        {data.map((d) => (
          <div key={d.label} className="grid grid-cols-[minmax(90px,30%)_1fr_auto] items-center gap-3 text-xs">
            <span className="truncate" title={d.label} style={{ color: "var(--admin-text-secondary)" }}>{d.label}</span>
            <span className="h-2.5 rounded-full" style={{ background: "var(--admin-surface-muted, #eef2f6)" }}>
              <span className="block h-2.5 rounded-full" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: "#11AFA8" }} />
            </span>
            <span className="font-bold tabular-nums" style={forceTextColor({ color: "var(--admin-text-primary)" })}>
              {formatChartValue(d.value, chart.valueFormat)}{chart.type === "donut" ? ` · %${((d.value / total) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : ""}
            </span>
          </div>
        ))}
      </div>
      {chart.caption && <p className="mt-3 text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{chart.caption}</p>}
    </figure>
  );
}

function SectionView({ section, number }: { section: DocumentSection; number: number | null }) {
  const sub = isSubsection(section);
  return (
    <div role="region" className={sub ? "mt-5" : "mt-8"} aria-label={section.title || undefined}>
      {sub ? (
        <h4 className="border-l-[3px] pl-2 text-sm font-black" style={forceTextColor({ color: "var(--admin-text-primary)", borderColor: "#11AFA8" })}>{section.title}</h4>
      ) : (
        <div>
          {number !== null && <p className="text-xs font-black tracking-[.14em]" style={forceTextColor({ color: "#0B7B76" })}>{String(number).padStart(2, "0")}</p>}
          <h3 className="text-lg font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{section.title}</h3>
          <div className="mt-1 h-0.5 w-10 rounded" style={{ background: "#11AFA8" }} />
        </div>
      )}
      {section.intro && <p className="mt-2 text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{section.intro}</p>}
      {!!section.metrics?.length && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {section.metrics.map((m) => (
            <div key={m.label} className="rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft, #f5f8fa)" }}>
              <p className="text-[10px] font-black uppercase tracking-[.1em]" style={forceTextColor({ color: "var(--admin-text-muted)" })}>{m.label}</p>
              <p className="mt-1 text-lg font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{m.value}</p>
              {m.note && <p className="mt-0.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>{m.note}</p>}
            </div>
          ))}
        </div>
      )}
      {section.charts?.map((chart, i) => <ChartView key={`${chart.title}-${i}`} chart={chart} />)}
      {section.text && <Paragraphs text={section.text} />}
      {!!section.items?.length && (
        <ul className="mt-2 grid gap-1.5 text-sm leading-6" style={{ color: "var(--admin-text-primary)" }}>
          {section.items.map((item, i) => {
            const level = (item.match(/^( {2})+/)?.[0].length || 0) / 2;
            return <li key={i} className="flex gap-2" style={{ paddingLeft: level * 14 }}><span aria-hidden className="mt-2.5 size-1.5 shrink-0" style={{ background: "#11AFA8" }} />{item.trim().replace(/^[•·\-–]\s+/, "")}</li>;
          })}
        </ul>
      )}
      {!!section.timeline?.length && (
        <ol className="mt-3 grid gap-3">
          {section.timeline.map((phase) => (
            <li key={phase.label} className="rounded-[10px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{phase.label}</p>
              <ul className="mt-1 list-disc pl-5 text-sm" style={{ color: "var(--admin-text-secondary)" }}>{phase.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
            </li>
          ))}
        </ol>
      )}
      {section.table && (
        <div className="mt-3 overflow-x-auto rounded-[10px] border" style={{ borderColor: "var(--admin-border)" }}>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr style={{ background: "#10243A" }}>
                {section.table.headers.map((h) => <th key={h} scope="col" className="px-3 py-2 text-xs font-black uppercase tracking-[.06em]" style={forceTextColor({ color: "#FFFFFF" })}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, r) => (
                <tr key={r} style={{ background: r % 2 ? "var(--admin-surface-soft, #f7f9fb)" : "var(--admin-surface)" }}>
                  {section.table!.headers.map((_, c) => {
                    const cell = row[c];
                    return (
                      <td key={c} className="border-t px-3 py-2 align-top" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}>
                        {cell !== undefined && isDocumentLink(cell) && safeHref(cell.url)
                          ? <a href={safeHref(cell.url)!} target="_blank" rel="noreferrer noopener" className="underline" style={{ color: "#0B7B76" }}>{cell.label}</a>
                          : <span className="whitespace-pre-line">{cell === undefined ? "" : cellLabel(cell)}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.callout && (
        <div className="mt-3 rounded-[10px] border-l-4 p-3 text-sm" style={{ borderColor: "#11AFA8", background: "var(--admin-surface-soft, #f5f8fa)", color: "var(--admin-text-primary)" }}>
          {section.callout.title && <p className="font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{section.callout.title}</p>}
          <p className="mt-1 whitespace-pre-line leading-6">{section.callout.text}</p>
        </div>
      )}
    </div>
  );
}

function sectionHasBody(s: DocumentSection) {
  return Boolean(s.text || s.items?.length || s.table || s.metrics?.length || s.charts?.length || s.callout || s.timeline?.length);
}

export function ReportDocumentView({ document }: { document: ViewerDocument }) {
  const sections = document.sections.filter(sectionHasBody);
  let counter = 0;
  return (
    <div className="text-left" data-testid="report-document">
      {/* Plain divs: the admin theme force-styles header/section/article. */}
      <div className="rounded-[14px] p-5" style={{ background: "#10243A" }}>
        {document.confidentialLabel && <p className="text-[11px] font-black tracking-[.18em]" style={forceTextColor({ color: "#7FE0DA" })}>DAHİLİ RAPOR · MÜŞTERİYLE PAYLAŞILMAZ</p>}
        <h2 className="mt-1 text-xl font-black" style={forceTextColor({ color: "#FFFFFF" })}>{document.title.replace(/^HK\s*Dijital\s*[—–-]\s*/i, "")}</h2>
        <p className="mt-1 text-sm font-bold" style={forceTextColor({ color: "#7FE0DA" })}>{document.customerName}</p>
        {document.period && document.period !== "-" && <p className="mt-0.5 text-xs" style={{ color: "rgba(255,255,255,.75)" }}>{document.period}</p>}
      </div>
      {!!document.metaLines?.length && (
        <dl className="mt-3 grid gap-2 rounded-[12px] border p-4 text-sm sm:grid-cols-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft, #f5f8fa)" }}>
          {document.metaLines.map((line) => {
            const i = line.indexOf(":");
            return i > 0 ? (
              <div key={line}><dt className="text-xs" style={{ color: "var(--admin-text-muted)" }}>{line.slice(0, i)}</dt><dd className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{line.slice(i + 1).trim()}</dd></div>
            ) : <div key={line} className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{line}</div>;
          })}
        </dl>
      )}
      {(document.executiveSummary || document.headlineMetrics?.length) && (
        <div role="region" className="mt-6" aria-label="Yönetici Özeti">
          <p className="text-xs font-black tracking-[.14em]" style={forceTextColor({ color: "#0B7B76" })}>YÖNETİCİ ÖZETİ</p>
          {document.executiveSummary && <Paragraphs text={document.executiveSummary} />}
          {!!document.headlineMetrics?.length && <SectionView section={{ title: "", metrics: document.headlineMetrics }} number={null} />}
        </div>
      )}
      {sections.map((section, i) => {
        const number = isSubsection(section) ? null : ++counter;
        return <SectionView key={`${section.title}-${i}`} section={section} number={number} />;
      })}
      {document.footerNote && <p className="mt-8 rounded-[10px] p-3 text-xs" style={{ background: "var(--admin-surface-soft, #f5f8fa)", color: "var(--admin-text-muted)" }}>{document.footerNote}</p>}
    </div>
  );
}
