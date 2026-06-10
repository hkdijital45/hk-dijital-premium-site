export type DiscoveredBusiness = {
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  googleRating?: number | null;
  reviewCount?: number;
  placeId?: string;
  category?: string;
  isDemo?: boolean;
};

const highAdPotentialCategories = [
  "oto", "otomotiv", "emlak", "diş", "dis", "klinik", "güzellik", "guzellik",
  "estetik", "sağlık", "saglik", "restoran", "kafe", "kuaför", "spor", "hukuk"
];

export function discoveryPriorityLabel(score: number) {
  if (score >= 80) return "Sıcak Fırsat";
  if (score >= 60) return "Takip Edilebilir";
  if (score >= 40) return "Orta Potansiyel";
  return "Düşük Öncelik";
}

export function scoreDiscoveredBusiness(business: DiscoveredBusiness) {
  const rating = Number(business.googleRating || 0);
  const reviews = Number(business.reviewCount || 0);
  const category = String(business.category || "").toLocaleLowerCase("tr-TR");
  const highPotential = highAdPotentialCategories.some((item) => category.includes(item));
  const heatReasons: string[] = [];
  const maturityReasons: string[] = [];
  let heat = 15;
  let maturity = 10;

  if (!business.website) {
    heat += 24;
    heatReasons.push("Website yok: reklam ve landing page fırsatı");
  } else {
    maturity += 28;
    maturityReasons.push("Website var: dijital varlık hazır");
  }

  if (business.phone) {
    heat += 18;
    maturity += 16;
    heatReasons.push("Telefon var: ulaşılabilir lead");
    maturityReasons.push("Telefon var: profil iletişim açısından tamamlanmış");
  }

  if (business.address) {
    heat += 8;
    maturity += 10;
    maturityReasons.push("Adres var: işletme profili daha güvenilir");
  }

  if (rating >= 4.5) {
    heat += 16;
    maturity += 18;
    heatReasons.push("Google puanı çok yüksek: dönüşüm potansiyeli güçlü");
    maturityReasons.push("Yüksek puan: güven sinyali kuvvetli");
  } else if (rating >= 4) {
    heat += 12;
    maturity += 14;
    heatReasons.push("Google puanı yüksek: teklif kabul potansiyeli güçlü");
    maturityReasons.push("4.0+ puan: müşteri memnuniyeti sinyali var");
  } else if (rating > 0) {
    heat += 5;
    maturity += 7;
    maturityReasons.push("Google puanı var: profil tamamen boş değil");
  }

  if (reviews === 0) {
    heat += 6;
    heatReasons.push("Yorum yok: itibar yönetimi fırsatı");
  } else if (reviews < 25) {
    heat += 12;
    maturity += 8;
    heatReasons.push("Yorum sayısı düşük: itibar yönetimi fırsatı");
    maturityReasons.push("Yorumlar başlamış: profil aktif görünüyor");
  } else if (reviews < 100) {
    heat += 10;
    maturity += 16;
    heatReasons.push("Orta yorum hacmi: reklamla büyütülebilir aktif işletme");
    maturityReasons.push("Yorum sayısı orta: sosyal kanıt mevcut");
  } else {
    heat += 6;
    maturity += 24;
    maturityReasons.push("Yorum sayısı yüksek: güçlü sosyal kanıt");
  }

  if (highPotential) {
    heat += 12;
    heatReasons.push("Sektör reklam potansiyeli yüksek");
  }

  if (business.isDemo) {
    heatReasons.push("Demo veri: gerçek arama yerine örnek sonuç gösteriliyor");
  }

  const leadHeatScore = Math.max(0, Math.min(100, Math.round(heat)));
  const digitalMaturityScore = Math.max(0, Math.min(100, Math.round(maturity)));
  return {
    digitalMaturityScore,
    leadHeatScore,
    priorityLabel: discoveryPriorityLabel(leadHeatScore),
    scoreReasons: {
      heat: heatReasons,
      maturity: maturityReasons
    }
  };
}
