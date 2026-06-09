"use client";

const charts = [
  { key: "impressions", title: "Gösterim trendi", help: "Reklamınızın veya içeriğinizin toplam kaç kez göründüğünü tarih bazında gösterir.", color: "#22d3ee" },
  { key: "reach", title: "Erişim trendi", help: "İçerik veya reklamların kaç farklı kişiye ulaştığını tarih bazında gösterir.", color: "#34d399" },
  { key: "clicks", title: "Tıklama trendi", help: "Seçilen dönemde reklama veya bağlantıya gelen tıklamaların seyrini gösterir.", color: "#38bdf8" },
  { key: "spent", title: "Harcama trendi", help: "Seçilen tarih aralığında kullanılan bütçenin günlük veya haftalık değişimini gösterir.", color: "#fb7185" },
  { key: "average_cpc", title: "CPC (Tıklama Başı Maliyet)", help: "Bir reklam tıklaması için ortalama ne kadar bütçe kullanıldığını gösterir.", color: "#a78bfa" },
  { key: "cpm", title: "CPM (Bin Gösterim Maliyeti)", help: "Reklamın bin kez gösterilmesi için oluşan ortalama maliyeti gösterir.", color: "#f97316" },
  { key: "ctr", title: "CTR (Tıklanma Oranı)", help: "Reklamı gören kişilerin ne kadarının tıkladığını gösterir.", color: "#facc15" },
  { key: "leads", title: "Lead / Sonuç trendi", help: "Potansiyel müşteri, sonuç veya dönüşüm aksiyonlarının dönem içindeki değişimini gösterir.", color: "#10b981" },
  { key: "messages", title: "Mesaj başlatma trendi", help: "Reklam veya içerik sonrası başlayan mesajların dönem içindeki değişimini gösterir.", color: "#60a5fa" }
];

function formatValue(key: string, value: number) {
  if (key === "spent" || key === "average_cpc" || key === "cpm") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
  if (key === "ctr") return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function CustomerReportCharts({ rows = [] }: { rows?: any[] }) {
  if (!rows.length) return <p className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">Grafik için henüz rapor verisi bulunmuyor.</p>;
  const usableCharts = charts.filter((chart) => rows.some((row) => Number(row[chart.key] || 0) > 0));
  if (!usableCharts.length) return <p className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">Bu raporda grafikle gösterilecek metrik verisi bulunamadı.</p>;
  if (rows.length < 2) {
    return (
      <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-black text-white">Dönem özeti grafiği</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">Bu rapor tek toplam satırdan oluşuyor. Günlük veri olmadığı için sahte günlük trend üretilmedi; aşağıda dönem seviyesindeki gerçek değerler gösteriliyor.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {usableCharts.map((chart) => {
            const value = Number(rows[0]?.[chart.key] || 0);
            const max = Math.max(...usableCharts.map((item) => Number(rows[0]?.[item.key] || 0)), 1);
            return (
              <div key={chart.key} className="rounded-[8px] border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-200">{chart.title}</p>
                  <span className="text-sm font-black text-white">{formatValue(chart.key, value)}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (value / max) * 100)}%`, backgroundColor: chart.color }} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-400">{chart.help}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {usableCharts.map((chart) => {
        const values = rows.map((row) => Number(row[chart.key] || 0));
        const max = Math.max(...values, 1);
        const points = values.map((value, index) => `${index * (100 / Math.max(1, values.length - 1))},${96 - (value / max) * 84}`).join(" ");
        const last = values[values.length - 1] || 0;
        return (
          <div key={chart.key} className="rounded-[8px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_20px_70px_rgba(15,23,42,.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h5 className="text-sm font-black text-white">{chart.title}</h5>
                <p className="mt-1 text-xs text-slate-400">Son değer: {formatValue(chart.key, last)}</p>
              </div>
              <span className="h-3 w-3 rounded-full shadow-[0_0_18px_currentColor]" style={{ backgroundColor: chart.color, color: chart.color }} />
            </div>
            <svg viewBox="0 0 100 100" className="mt-3 h-40 w-full" preserveAspectRatio="none" role="img" aria-label={chart.title}>
              <defs>
                <linearGradient id={`customer-${chart.key}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={chart.color} stopOpacity=".2" />
                  <stop offset="100%" stopColor={chart.color} stopOpacity="1" />
                </linearGradient>
              </defs>
              <polyline fill="none" stroke={`url(#customer-${chart.key})`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" points={points} />
              <line x1="0" x2="100" y1="96" y2="96" stroke="rgba(255,255,255,.16)" />
            </svg>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-500">
              <span>{rows[0]?.label || rows[0]?.date}</span>
              <span>{rows[rows.length - 1]?.label || rows[rows.length - 1]?.date}</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{chart.help}</p>
          </div>
        );
      })}
    </div>
  );
}
