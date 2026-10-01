// Private Supabase Storage persistence for Reklam Değerlendirme PDF/DOCX
// exports — same raw Storage REST pattern already used for
// team_attachments/communication-attachments (upload via service-role
// key, read back only through a short-lived signed URL), reused as-is
// rather than adding a new storage abstraction. Bucket: ad-evaluation-
// reports (private — created by 20261001_ad_evaluations.sql), never a
// public URL, since these files carry real customer performance data.
import "server-only";

const BUCKET = "ad-evaluation-reports";

function storageConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error("Supabase Storage yapılandırılmadı.");
  return { baseUrl, key };
}

export function adEvaluationStoragePath(companyId: string, campaignId: string | null, evaluationId: string, fileName: string) {
  return `${companyId}/${campaignId || "no-campaign"}/${evaluationId}/${fileName}`;
}

export async function uploadAdEvaluationFile(path: string, buffer: Buffer, contentType: string): Promise<void> {
  const { baseUrl, key } = storageConfig();
  const response = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "true" },
    body: buffer as unknown as BodyInit
  });
  if (!response.ok) throw new Error(`Rapor dosyası depolama alanına yüklenemedi: ${path}`);
}

/** Best-effort batch delete of this evaluation's own stored files
 * (Rapor Merkezi "Sil" action) — never throws, a storage-side failure
 * must not block the row delete that calls this. */
export async function deleteAdEvaluationFiles(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { baseUrl, key } = storageConfig();
  await fetch(`${baseUrl}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths })
  }).catch(() => {});
}

/** Short-lived signed URL — never a permanent/public link. Caller must
 * already have verified the requesting staff user owns/can see this
 * company's evaluation before calling this. */
export async function signAdEvaluationFileUrl(path: string, expiresInSeconds = 300): Promise<string> {
  const { baseUrl, key } = storageConfig();
  const response = await fetch(`${baseUrl}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: expiresInSeconds })
  });
  const payload = await response.json().catch(() => ({}));
  const signedPath = payload.signedURL || payload.signedUrl;
  if (!response.ok || !signedPath) throw new Error("Rapor dosyası bağlantısı oluşturulamadı.");
  return signedPath.startsWith("http") ? signedPath : `${baseUrl}/storage/v1${signedPath}`;
}
