export type SocialKey =
  | "instagram"
  | "facebook"
  | "youtube"
  | "twitter"
  | "linkedin"
  | "whatsapp"
  | "tiktok";

export type Service = {
  id: string;
  name: string;
  icon: string;
  imageUrl?: string;
  description: string;
  detailedDescription: string;
  audience: string;
  problem: string;
  included: string[];
  cta: string;
  order: number;
  visible: boolean;
};

export type PackageItem = {
  id: string;
  name: string;
  imageUrl?: string;
  price: string;
  description: string;
  features: string[];
  recommended: boolean;
  visible: boolean;
  cta: string;
  order?: number;
};

export type Certificate = {
  id: string;
  title: string;
  institution: string;
  date: string;
  description: string;
  fileUrl: string;
  verificationUrl: string;
  order: number;
  visible: boolean;
};

export type LeadStatus =
  | "Yeni"
  | "Görüşülecek"
  | "Teklif Hazırlanıyor"
  | "Teklif Gönderildi"
  | "Takipte"
  | "Kazanıldı"
  | "Kaybedildi"
  | "Dönüştürüldü";

export type Lead = {
  id: string;
  source: "quote" | "contact" | string;
  name: string;
  company: string;
  phone: string;
  email: string;
  instagram?: string;
  website?: string;
  address?: string;
  city?: string;
  district?: string;
  sector?: string;
  source_url?: string;
  google_place_id?: string;
  google_rating?: number | null;
  google_review_count?: number;
  businessType?: string;
  goal?: string;
  budget?: string;
  recommendedPackage?: string;
  alternativePackage?: string;
  note?: string;
  internalNotes?: string;
  followUpDate?: string;
  status: LeadStatus;
  createdAt: string;
};

export type QuoteOption = {
  id: string;
  label: string;
};

export type RecommendationRule = {
  businessType?: string;
  goal?: string;
  budget?: string;
  recommendedPackage: string;
  alternativePackage: string;
};

export type SiteContent = {
  brand: {
    companyName: string;
    founder: string;
    slogan: string;
    logoUrl: string;
    footerLogoUrl: string;
    faviconUrl: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      button: string;
      background: string;
    };
    typography: {
      heading: string;
      body: string;
    };
  };
  socials: Record<SocialKey, string>;
  contact: {
    phone: string;
    whatsappNumber: string;
    email: string;
    address: string;
    mapsEmbedUrl: string;
  };
  settings: {
    siteTitle: string;
    siteDescription: string;
    maintenanceMode: boolean;
    defaultTheme: "dark" | "light";
    analyticsIds: {
      metaPixel: string;
      googleTagManager: string;
      gaMeasurement: string;
    };
    api: {
      geminiApiKey: string;
      groqApiKey: string;
      openAiApiKey: string;
      activeProvider: "demo" | "gemini" | "groq" | "openai" | "automatic" | "local" | string;
      active_ai_provider?: "automatic" | "demo" | "local" | "gemini" | "groq" | "openai" | string;
      active_ai_model?: string;
      ai_mode?: "live" | "demo" | "local" | string;
      ai_provider_priority?: string[];
      ai_status_last_test_at?: string;
      ai_status?: Record<string, { name?: string; status?: string; model?: string; lastTestTime?: string; warning?: string }>;
      demoMode: boolean;
      model: string;
    };
    legalDisclaimers: string[];
  };
  seo: Record<string, { title: string; description: string }>;
  pages: {
    home: {
      headline: string;
      subheadline: string;
      primaryCta: string;
      secondaryCta: string;
      trustIndicators: string[];
      process: string[];
      intelligenceTeaser: string;
      disclaimers: string[];
    };
    about: { title: string; content: string; highlights: string[] };
    certificates: { title: string; intro: string };
    services: { intro: string };
    packages: { intro: string };
    intelligence: { title: string; content: string; features: string[] };
    contact: { intro: string };
  };
  certificates: Certificate[];
  services: Service[];
  packages: PackageItem[];
  quoteWizard: {
    title: string;
    subtitle: string;
    businessTypes: QuoteOption[];
    goals: QuoteOption[];
    budgets: QuoteOption[];
    recommendationRules: RecommendationRule[];
    ctaTexts: { next: string; back: string; submit: string; whatsapp: string };
    formFields: { id: string; label: string; required: boolean; type: string }[];
    successMessage: string;
    whatsappTemplate: string;
  };
  leads: Lead[];
  media: { id: string; url: string; type: "image" | "video" | "pdf"; name: string }[];
};
