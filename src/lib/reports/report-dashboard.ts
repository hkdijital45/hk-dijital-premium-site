export function reportDashboardStats(reports: any[]) {
  const month = new Date().toISOString().slice(0, 7);
  return {
    customerCount: new Set(reports.map((report) => report.company_id).filter(Boolean)).size,
    createdThisMonth: reports.filter((report) => String(report.created_at || "").startsWith(month)).length,
    awaitingComment: reports.filter((report) => !report.customer_note).length,
    sentByEmail: reports.filter((report) => report.sent_at).length
  };
}

export function customerReportSummary(reports: any[]) {
  const latest = reports[0];
  const best = [...reports].sort((a, b) => Number(b.metrics?.leads || b.metrics?.engagement || b.metrics?.clicks || 0) - Number(a.metrics?.leads || a.metrics?.engagement || a.metrics?.clicks || 0))[0];
  return {
    latest,
    bestChannel: best?.platform || best?.report_type || "Henüz veri yok",
    nextAction: latest?.customer_note || "Yeni rapor verileri geldikçe sonraki önerilen adım burada paylaşılır."
  };
}
