export type AdminActionAuditStatus = "Doğrulandı" | "Düzeltildi" | "Açıklamalı Pasif";

export type AdminActionAuditItem = {
  module: string;
  action: string;
  status: AdminActionAuditStatus;
  note: string;
};

export const adminActionAudit: AdminActionAuditItem[] = [
  { module: "Dashboard", action: "KPI ve hızlı işlem yönlendirmeleri", status: "Doğrulandı", note: "Mevcut admin route ve modül seçimlerini açar." },
  { module: "HK Intelligence Command Center", action: "KPI, risk, takvim ve AI özet aksiyonları", status: "Doğrulandı", note: "Mevcut center-data ve operations-assistant kaynaklarını kullanır." },
  { module: "Satış Hunisi", action: "Lead güncelleme ve aşama değiştirme", status: "Düzeltildi", note: "Doğrudan lead PATCH API ile kalıcıdır; PGRST204 uyumluluk fallback'i vardır." },
  { module: "Satış Hunisi", action: "Takip/toplantı/teklif tarihleri", status: "Düzeltildi", note: "calendar_follow_up_at migration ile güvenceye alındı ve otomatik görev üretir." },
  { module: "Satış Hunisi", action: "Müşteriye dönüştürme", status: "Doğrulandı", note: "Duplicate şirket kontrolü, görünürlük ve onboarding görevleri sunucuda çalışır." },
  { module: "Satış Hunisi", action: "Arşivleme ve geri yükleme", status: "Doğrulandı", note: "deleted_at tabanlı soft delete kullanır." },
  { module: "Müşteri Profili", action: "Yapılacak görev ekleme/düzenleme/tamamlama", status: "Düzeltildi", note: "Her işlem customer-operations API yanıtıyla doğrulanır." },
  { module: "Müşteri Profili", action: "Görev arşivleme", status: "Düzeltildi", note: "Hard delete yerine archived_at güncellenir." },
  { module: "Müşteri Profili", action: "Müşteri Kurulumu", status: "Düzeltildi", note: "Şirket ve customer_branding tek sunucu akışında kalıcı kaydedilir." },
  { module: "Müşteri Paneli", action: "Logo, marka adı, renk, iletişim ve rapor başlığı", status: "Düzeltildi", note: "Müşteri bazlı customer_branding kaydı kullanılır." },
  { module: "Tahsilat", action: "Kayıt ekleme/güncelleme/arşivleme", status: "Doğrulandı", note: "payment_records ve customer-operations API kullanılır." },
  { module: "Görevler", action: "Görev durum ve tarih işlemleri", status: "Doğrulandı", note: "agency_tasks kaynağı ve şema onarım migration'ı kullanılır." },
  { module: "Karlılık", action: "Gelir, gider ve müşteri karlılık hesapları", status: "Doğrulandı", note: "Tahsilat, gider ve kampanya kayıtlarından hesaplanan mevcut veri akışı korunur." },
  { module: "Raporlama", action: "Rapor kaydetme ve export", status: "Doğrulandı", note: "Mevcut reports API ve export route'ları korunur." },
  { module: "Dosyalar ve Belgeler", action: "Belge ekleme, görünürlük ve arşivleme", status: "Doğrulandı", note: "customer_files ve customer_documents kayıtları müşteri görünürlüğüyle birlikte kaydedilir." },
  { module: "Meta/Google Entegrasyonları", action: "Kaydet, test ve senkronizasyon", status: "Doğrulandı", note: "Hata yanıtları başarılı toast olarak gösterilmez; tokenlar sunucuda kalır." },
  { module: "AI Studio", action: "İçerik ve analiz üretimi", status: "Doğrulandı", note: "Mevcut AI provider route'u ve anahtar yokken fallback yanıtı kullanılır." },
  { module: "Teklif Motoru", action: "Teklif oluşturma, kaydetme ve yönlendirme", status: "Doğrulandı", note: "Lead parametreleri mevcut teklif ekranına taşınır; belge kaydı ortak veri kaynağını kullanır." },
  { module: "WhatsApp CRM", action: "Mesaj hazırlama, kopyalama ve temas kaydı", status: "Düzeltildi", note: "Telefon eksikse açıklamalı pasiftir; gönderim öncesinde son temas zamanı kalıcı kaydedilir." },
  { module: "Sistem Ayarları", action: "Ayar kaydetme ve bağlantı testleri", status: "Doğrulandı", note: "Mevcut yetki kontrolü ve server-side secret saklama akışları korunur." },
  { module: "Sistem Rehberi", action: "Rehber CRUD, arama ve geri bildirim", status: "Doğrulandı", note: "Admin yetkisi ve kalıcı guide tabloları kullanılır." },
  { module: "Sistem Sağlık Merkezi", action: "Servis testleri ve yenileme", status: "Doğrulandı", note: "Testler yalnız modül açıldığında çalışır ve mevcut sağlık endpoint'lerini kullanır." },
  { module: "Log ve Aktivite Merkezi", action: "Başarısız işlem kaydı", status: "Düzeltildi", note: "Hata kodu ve mesajı activity_logs details alanına kaydedilir." }
];

export const adminActionAuditSummary = {
  checkedModules: new Set(adminActionAudit.map((item) => item.module)).size,
  checkedActions: adminActionAudit.length,
  fixedActions: adminActionAudit.filter((item) => item.status === "Düzeltildi").length
};
