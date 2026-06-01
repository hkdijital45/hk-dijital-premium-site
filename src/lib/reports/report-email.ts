export async function sendReportEmail({ to, subject, message, attachments = [] }: { to: string; subject: string; message: string; attachments?: Array<{ filename: string; content: Buffer }> }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  if (!key || !from) throw new Error("E-posta sağlayıcısı yapılandırılmadığı için gönderim yapılamadı.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], subject,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>HK Dijital</h2><p>${message.replaceAll("\n", "<br />")}</p><p><a href="https://www.hkdijital.com.tr/musteri-paneli">Müşteri panelini açın</a></p></div>`,
      attachments: attachments.map((item) => ({ filename: item.filename, content: item.content.toString("base64") }))
    })
  });
  if (!response.ok) throw new Error("E-posta gönderilemedi. Sağlayıcı ayarlarını kontrol edin.");
  return response.json();
}
