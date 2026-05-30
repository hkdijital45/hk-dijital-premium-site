export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabaseWarning() {
  return "Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.";
}

function supabaseHeaders(serviceRole = true) {
  const key = serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    apikey: key || "",
    Authorization: `Bearer ${key || ""}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

export async function supabaseRest<T>(
  path: string,
  init: RequestInit = {},
  serviceRole = true
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error(getSupabaseWarning());

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(serviceRole),
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Supabase REST hatası (${response.status}) ${path}: ${detail || "Supabase isteği başarısız oldu."}`
    );
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function uploadToSupabaseStorage(file: File, folder = "media") {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new Error(getSupabaseWarning());

  const safeName = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const response = await fetch(
    `${baseUrl}/storage/v1/object/hk-dijital-media/${safeName}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true"
      },
      body: Buffer.from(await file.arrayBuffer())
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Storage yükleme başarısız oldu.");
  }

  return `${baseUrl}/storage/v1/object/public/hk-dijital-media/${safeName}`;
}
