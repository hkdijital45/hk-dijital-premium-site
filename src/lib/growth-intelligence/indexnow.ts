export function getIndexNowStatus() {
  const key = String(process.env.INDEXNOW_KEY || "").trim();
  return {
    ready: Boolean(key),
    message: key
      ? "IndexNow anahtarı yapılandırıldı."
      : "IndexNow anahtarı eksik; INDEXNOW_KEY ortam değişkenini ekleyin."
  };
}

export async function submitUrlsToIndexNow(urls: string[], siteHost: string) {
  const key = String(process.env.INDEXNOW_KEY || "").trim();
  if (!key) return { ok: false, status: 0, message: "INDEXNOW_KEY ayarlı değil." };
  const cleanUrls = urls.filter(Boolean).slice(0, 10000);
  if (!cleanUrls.length) return { ok: false, status: 0, message: "Gönderilecek URL yok." };

  try {
    const response = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: siteHost,
        key,
        keyLocation: `https://${siteHost}/${key}.txt`,
        urlList: cleanUrls
      })
    });
    return {
      ok: response.ok,
      status: response.status,
      message: response.ok ? "IndexNow gönderimi kabul edildi." : `IndexNow API ${response.status} döndürdü.`
    };
  } catch (error) {
    return { ok: false, status: 0, message: error instanceof Error ? error.message : "IndexNow gönderimi başarısız oldu." };
  }
}
