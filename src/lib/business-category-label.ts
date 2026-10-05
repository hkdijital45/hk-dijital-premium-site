const CATEGORY_LABELS: Record<string, string> = {
  beauty_salon: "Güzellik Salonu",
  hair_care: "Kuaför",
  hair_salon: "Kuaför",
  dentist: "Diş Kliniği",
  restaurant: "Restoran",
  cafe: "Kafe",
  bakery: "Fırın",
  real_estate_agency: "Emlak Ofisi",
  veterinary_care: "Veteriner Kliniği",
  car_repair: "Oto Servis",
  car_dealer: "Oto Galeri",
  gym: "Spor Salonu",
  lawyer: "Hukuk Bürosu",
  accounting: "Mali Müşavir",
  spa: "Spa Merkezi"
};

const GENERIC_CATEGORIES = new Set(["establishment", "point_of_interest", "store", "food", "health", "local_business"]);

function humanize(raw: string): string {
  if (!raw.includes("_")) return raw;
  return raw.split("_").filter(Boolean).map((word) => word.charAt(0).toLocaleUpperCase("tr") + word.slice(1)).join(" ");
}

export function businessCategoryLabel(raw: unknown): string {
  const parts = String(raw ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return "";
  const specific = parts.filter((part) => !GENERIC_CATEGORIES.has(part));
  if (!specific.length) return "Genel İşletme";
  return CATEGORY_LABELS[specific[0]] ?? humanize(specific[0]);
}
