"use client";

// Same fetch -> blob -> transient <a> pattern AgentHubCenter.tsx already
// uses for its document exports (triggerBlobDownload) — an authenticated
// GET to a PDF route can't be a plain rendered <a href> (Next's own
// no-html-link-for-pages rule flags internal-looking hrefs, and a real
// <Link> would try to client-navigate to a binary response instead of
// downloading it).
export async function downloadHandbookPdf() {
  const response = await fetch("/api/admin/system-guide/el-kitabi/pdf");
  if (!response.ok) {
    window.alert("El kitabı PDF'i indirilemedi.");
    return;
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "HK-Admin-El-Kitabi.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
