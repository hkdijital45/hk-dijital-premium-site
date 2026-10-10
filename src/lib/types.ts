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
  is_test?: boolean;
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
  requestedPlatforms?: string[];
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
    footerDescription?: string;
    logoUrl: string;
    footerLogoUrl: string;
    faviconUrl: string;
    loginLogoUrl?: string;
    customerLogoUrl?: string;
    pdfLogoUrl?: string;
    emailLogoUrl?: string;
    openGraphLogoUrl?: string;
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
    whatsappDefaultMessage?: string;
    email: string;
    address: string;
    city?: string;
    district?: string;
    workingHours?: string;
    addressVisible?: boolean;
    mapsEmbedUrl: string;
  };
  mediaAssets?: Record<string, string>;
  settings: {
    siteTitle: string;
    siteDescription: string;
    maintenanceMode: boolean;
    defaultTheme: "dark" | "light";
    performanceMode?: "ultra" | "balanced" | "performance";
    analyticsIds: {
      metaPixel: string;
      googleTagManager: string;
      gaMeasurement: string;
    };
    api: {
      [key: string]: unknown;
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

// CRITICAL (2026-10-11): the only fields any public (unauthenticated,
// client-component) part of the site may ever receive. SiteContent's
// `site_settings.value` row is shared storage for far more than CMS copy —
// in production it also carries real leads, user accounts, customer
// documents/integrations (with encrypted tokens), ad metrics, activity
// logs, etc. (none of them declared on the SiteContent type above, but
// present on the real row and passed through untyped object spreads).
// Passing a raw SiteContent object into a "use client" component boundary
// serializes ALL of it into the page's RSC payload, visible to anyone who
// views source — this is exactly how that data was leaking on every public
// page via PublicShell → Header/Footer. Never widen this type with a
// spread; only ever construct it by naming each field explicitly (see
// src/components/public/Shell.tsx, src/app/page.tsx).
export type PublicSiteContent = Pick<SiteContent, "brand" | "socials" | "contact">;
