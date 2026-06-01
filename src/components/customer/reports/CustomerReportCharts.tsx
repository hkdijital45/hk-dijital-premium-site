"use client";

const charts = [
  ["spent", "Harcama değişimi", "Bu grafik, reklam harcamasının seçilen tarihlerde nasıl değiştiğini gösterir."],
  ["clicks", "Tıklama değişimi", "Bu grafik, reklamlara veya bağlantılara gelen tıklamaların dönem içindeki değişimini gösterir."],
  ["impressions", "Gösterim değişimi", "Bu grafik, içerik veya reklam görünürlüğünün zaman içindeki seyrini gösterir."],
  ["leads", "Potansiyel müşteri değişimi", "Bu grafik, dönem içinde oluşan iletişim ve talep kayıtlarını gösterir."]
];

export function CustomerReportCharts({ rows = [] }: { rows?: any[] }) {
  if (rows.length < 2) return <p className="text-sm text-slate-400">Grafik oluşturmak için en az iki tarihli veri kaydı gerekir.</p>;
  return <div className="grid gap-4 lg:grid-cols-2">{charts.map(([key, title, help]) => {
    const values = rows.map((row) => Number(row[key] || 0)); const max = Math.max(...values, 1);
    const points = values.map((value, index) => `${index * (100 / Math.max(1, values.length - 1))},${100 - (value / max) * 88}`).join(" ");
    return <div key={key} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><h5 className="text-sm font-black text-cyan-100">{title}</h5><svg viewBox="0 0 100 100" className="mt-3 h-40 w-full" preserveAspectRatio="none"><polyline fill="none" stroke="#67e8f9" strokeWidth="2" points={points} /><line x1="0" x2="100" y1="100" y2="100" stroke="rgba(255,255,255,.16)" /></svg><p className="mt-2 text-xs leading-5 text-slate-400">{help}</p></div>;
  })}</div>;
}
