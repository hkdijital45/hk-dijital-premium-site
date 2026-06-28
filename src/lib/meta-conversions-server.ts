/* eslint-disable @typescript-eslint/no-explicit-any */

export function getMetaDatasetStatus() {
  const pixelId = String(process.env.NEXT_PUBLIC_META_PIXEL_ID || "").trim();
  const datasetId = String(process.env.META_DATASET_ID || "").trim();
  const token = String(process.env.META_ACCESS_TOKEN || "").trim();
  return {
    ready: Boolean(pixelId && datasetId && token && /^\d+$/.test(datasetId)),
    pixelReady: Boolean(pixelId),
    datasetReady: Boolean(datasetId && /^\d+$/.test(datasetId)),
    tokenReady: Boolean(token),
    missingEnv: [
      ...(!pixelId ? ["NEXT_PUBLIC_META_PIXEL_ID"] : []),
      ...(!datasetId ? ["META_DATASET_ID"] : []),
      ...(!token ? ["META_ACCESS_TOKEN"] : [])
    ],
    message: datasetId
      ? "Meta Dataset ID server-side olay eşleşmesi için hazır görünüyor."
      : "Dataset ID, Events Manager > Data Sources > Pixel/Dataset > Settings alanından alınabilir."
  };
}

export function buildMetaConversionsPayload(input: Record<string, any> = {}) {
  const status = getMetaDatasetStatus();
  return {
    ok: status.ready,
    datasetIdConfigured: status.datasetReady,
    payload: status.ready
      ? {
          event_name: input.eventName || "Lead",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: input.eventSourceUrl || "",
          user_data: input.userData || {},
          custom_data: input.customData || {}
        }
      : null,
    message: status.message
  };
}

export async function sendMetaServerEvent(input: Record<string, any> = {}) {
  const status = getMetaDatasetStatus();
  if (!status.ready) {
    return { ok: false, message: "Meta Dataset ID veya Access Token eksik olduğu için server event gönderilmedi.", missingEnv: status.missingEnv };
  }
  return {
    ok: false,
    message: "Meta Conversions API payload hazırlığı tamamlandı; canlı gönderim sonraki fazda etkinleştirilebilir.",
    payload: buildMetaConversionsPayload(input).payload
  };
}
