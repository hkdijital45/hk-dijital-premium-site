create extension if not exists pgcrypto;

create or replace function public.set_blog_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.blog_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  content_format text not null default 'markdown',
  status text not null default 'draft' check (status in ('draft', 'review', 'scheduled', 'published', 'archived')),
  author_id uuid references public.users(id) on delete set null,
  author_name text not null default 'HK Dijital',
  cover_image_url text,
  cover_image_alt text,
  category_id uuid references public.blog_categories(id) on delete set null,
  primary_keyword text not null default '',
  secondary_keywords text[] not null default '{}',
  search_intent text not null default '',
  target_location text,
  meta_title text not null default '',
  meta_description text not null default '',
  canonical_url text,
  og_title text,
  og_description text,
  og_image_url text,
  featured boolean not null default false,
  allow_indexing boolean not null default true,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  reading_time integer not null default 1 check (reading_time >= 1),
  word_count integer not null default 0 check (word_count >= 0),
  seo_score integer not null default 0 check (seo_score between 0 and 100),
  readability_score integer not null default 0 check (readability_score between 0 and 100),
  clarity_score integer not null default 0 check (clarity_score between 0 and 100),
  content_quality_score integer not null default 0 check (content_quality_score between 0 and 100)
);

create table if not exists public.blog_post_tags (
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  tag_id uuid not null references public.blog_tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (post_id, tag_id)
);

create table if not exists public.blog_post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  title text not null,
  content text not null,
  meta_title text not null default '',
  meta_description text not null default '',
  revision_note text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists blog_posts_status_published_idx on public.blog_posts (status, published_at desc);
create index if not exists blog_posts_category_idx on public.blog_posts (category_id);
create index if not exists blog_posts_primary_keyword_idx on public.blog_posts (lower(primary_keyword));
create index if not exists blog_posts_updated_idx on public.blog_posts (updated_at desc);
create index if not exists blog_post_revisions_post_idx on public.blog_post_revisions (post_id, created_at desc);

drop trigger if exists blog_categories_set_updated_at on public.blog_categories;
create trigger blog_categories_set_updated_at before update on public.blog_categories for each row execute function public.set_blog_updated_at();

drop trigger if exists blog_posts_set_updated_at on public.blog_posts;
create trigger blog_posts_set_updated_at before update on public.blog_posts for each row execute function public.set_blog_updated_at();

alter table public.blog_categories enable row level security;
alter table public.blog_tags enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_tags enable row level security;
alter table public.blog_post_revisions enable row level security;

drop policy if exists "Public can read active blog categories" on public.blog_categories;
create policy "Public can read active blog categories" on public.blog_categories for select using (is_active = true);

drop policy if exists "Public can read blog tags" on public.blog_tags;
create policy "Public can read blog tags" on public.blog_tags for select using (true);

drop policy if exists "Public can read published blog posts" on public.blog_posts;
create policy "Public can read published blog posts" on public.blog_posts for select using (
  status = 'published' and allow_indexing = true and (published_at is null or published_at <= timezone('utc', now()))
);

drop policy if exists "Public can read published blog post tags" on public.blog_post_tags;
create policy "Public can read published blog post tags" on public.blog_post_tags for select using (
  exists (
    select 1 from public.blog_posts post
    where post.id = blog_post_tags.post_id
      and post.status = 'published'
      and post.allow_indexing = true
      and (post.published_at is null or post.published_at <= timezone('utc', now()))
  )
);

drop policy if exists "Staff can manage blog categories" on public.blog_categories;
create policy "Staff can manage blog categories" on public.blog_categories for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage blog tags" on public.blog_tags;
create policy "Staff can manage blog tags" on public.blog_tags for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage blog posts" on public.blog_posts;
create policy "Staff can manage blog posts" on public.blog_posts for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can manage blog post tags" on public.blog_post_tags;
create policy "Staff can manage blog post tags" on public.blog_post_tags for all using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
) with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can read blog revisions" on public.blog_post_revisions;
create policy "Staff can read blog revisions" on public.blog_post_revisions for select using (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

drop policy if exists "Staff can create blog revisions" on public.blog_post_revisions;
create policy "Staff can create blog revisions" on public.blog_post_revisions for insert with check (
  exists (select 1 from public.users actor where actor.auth_user_id = auth.uid() and actor.role in ('admin', 'yonetici', 'editor', 'sales') and coalesce(actor.is_active, true) = true and actor.deleted_at is null)
);

insert into public.blog_categories (name, slug, description, sort_order)
values
  ('Instagram Reklamları', 'instagram-reklamlari', 'Instagram reklamı, bütçe, hedef kitle ve sonuç geliştirme rehberleri.', 10),
  ('Facebook Reklamları', 'facebook-reklamlari', 'Facebook ve Meta reklam yönetimiyle ilgili pratik işletme içerikleri.', 20),
  ('Google Reklamları', 'google-reklamlari', 'Google Ads, arama reklamları ve bütçe planlama içerikleri.', 30),
  ('Sosyal Medya', 'sosyal-medya', 'İşletmeler için sosyal medya yönetimi ve içerik planlama rehberleri.', 40),
  ('Reklam Stratejisi', 'reklam-stratejisi', 'Reklamdan müşteri ve satış üretmek için strateji odaklı içerikler.', 50),
  ('Küçük İşletmeler', 'kucuk-isletmeler', 'Küçük ve yerel işletmelere yönelik uygulanabilir reklam önerileri.', 60),
  ('Yerel Pazarlama', 'yerel-pazarlama', 'Manisa ve yerel hizmet işletmeleri için dijital pazarlama içerikleri.', 70),
  ('Dijital Pazarlama Rehberleri', 'dijital-pazarlama-rehberleri', 'Temel dijital pazarlama kararlarını açıklayan uzun ömürlü rehberler.', 80)
on conflict (slug) do nothing;

insert into public.blog_posts (
  title, slug, excerpt, content, status, author_name, category_id, primary_keyword, secondary_keywords,
  search_intent, target_location, meta_title, meta_description, featured, allow_indexing, published_at,
  reading_time, word_count, seo_score, readability_score, clarity_score, content_quality_score
)
select title, slug, excerpt, content, status, author_name, category_id, primary_keyword, secondary_keywords,
  search_intent, target_location, meta_title, meta_description, featured, allow_indexing, published_at,
  reading_time, word_count, seo_score, readability_score, clarity_score, content_quality_score
from (values
  ('Instagram Reklamı Nasıl Verilir? İşletmeler İçin Başlangıç Rehberi', 'instagram-reklami-nasil-verilir-isletmeler-icin-baslangic-rehberi', 'Instagram reklamı vermek isteyen işletmeler için hedef, kitle, bütçe, kreatif ve dönüşüm takibini sade bir sırayla açıklayan başlangıç rehberi.', '# Instagram Reklamı Nasıl Verilir? İşletmeler İçin Başlangıç Rehberi

Instagram reklamı, yalnızca gönderiyi öne çıkarmaktan ibaret değildir. İşletme için doğru reklam; hedefi, kitleyi, mesajı, bütçeyi ve dönüşüm takibini aynı anda düşünür.

## Gönderiyi öne çıkarmak ile Reklam Yöneticisi farkı
Gönderiyi öne çıkarmak hızlıdır; fakat hedefleme, ölçümleme ve test seçenekleri sınırlıdır. Reklam Yöneticisi ise mesaj, form, web sitesi ziyareti ve yeniden pazarlama gibi daha kontrollü hedeflerle çalışır.

## Hedefi netleştirin
Reklamdan ne beklediğinizi baştan belirleyin: WhatsApp mesajı mı, telefon araması mı, form mu, mağaza ziyareti mi, web sitesi dönüşümü mü?

## Kontrol listesi
- Hedef net mi?
- Reklam mesajı tek bir problemi çözüyor mu?
- WhatsApp veya form süreci hazır mı?
- Pixel veya dönüşüm takibi kurulu mu?

Instagram reklamlarını profesyonel kurmak istiyorsanız [Meta reklam yönetimi hizmetimizi](/hizmetler/meta-reklam-yonetimi) inceleyebilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'instagram-reklamlari'), 'Instagram reklamı nasıl verilir', array['Instagram reklamı vermek','Instagram reklam verme','Instagram reklam hedef kitle'], 'Bilgi edinme + hizmet araştırma', 'Türkiye, Manisa', 'Instagram Reklamı Nasıl Verilir? | HK Dijital', 'Instagram reklamı vermek isteyen işletmeler için hedef, kitle, bütçe, kreatif ve dönüşüm takibi rehberi.', true, true, '2026-07-15 09:00:00+00'::timestamptz, 6, 980, 86, 84, 88, 87),
  ('Instagram Reklamı Veriyorum Ama Müşteri Gelmiyor: 12 Muhtemel Neden', 'instagram-reklami-veriyorum-ama-musteri-gelmiyor', 'Reklam tıklanıyor ama mesaj, randevu veya satış gelmiyorsa sorun yalnız reklamda olmayabilir. En sık görülen 12 nedeni sade şekilde inceleyin.', '# Instagram Reklamı Veriyorum Ama Müşteri Gelmiyor: 12 Muhtemel Neden

Reklam verip müşteri alamamak her zaman platformun kötü çalıştığı anlamına gelmez. Reklam, teklif, hedef kitle, profil güveni ve satış süreci birlikte incelenmelidir.

## Kampanya hedefi yanlış olabilir
Etkileşim hedefi beğeni getirebilir; ancak satış niyeti yüksek kullanıcıları getirmeyebilir.

## Profil ve satış süreci hazır olmayabilir
Profilde adres, hizmet açıklaması, gerçek görseller ve iletişim yolu yoksa reklamdan gelen kişi karar veremez.

Reklamınız tıklanıyor ama satışa dönmüyorsa [dijital pazarlama danışmanlığı](/hizmetler/dijital-pazarlama-danismanligi) ile reklam ve satış sürecinizi birlikte inceleyebiliriz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'reklam-stratejisi'), 'Instagram reklamı müşteri gelmiyor', array['Instagram reklamı işe yaramıyor','reklam veriyorum müşteri gelmiyor','reklam dönüşümü nasıl artırılır'], 'Sorun çözme', 'Türkiye', 'Instagram Reklamı Müşteri Getirmiyor mu? 12 Neden', 'Instagram reklamı verip müşteri alamıyorsanız hedef, kreatif, teklif, WhatsApp süreci ve ölçüm tarafındaki 12 nedeni inceleyin.', true, true, '2026-07-15 09:00:00+00'::timestamptz, 7, 1120, 88, 86, 90, 88),
  ('Instagram Reklam Fiyatları: Reklam Bütçesi Nasıl Belirlenir?', 'instagram-reklam-fiyatlari-reklam-butcesi-nasil-belirlenir', 'Instagram reklam fiyatlarını sabit rakamlarla değil, hedef, rekabet, kreatif, şehir ve satış süreci üzerinden nasıl düşünmeniz gerektiğini anlatan rehber.', '# Instagram Reklam Fiyatları: Reklam Bütçesi Nasıl Belirlenir?

Instagram reklam fiyatları tek bir listeyle açıklanamaz. Maliyet; hedef kitleye, rekabete, reklam amacına ve satış sürecine göre değişir.

## Platform bütçesi ile ajans hizmet bedeli farklıdır
Platform bütçesi Meta’ya ödenen reklam harcamasıdır. Ajans hizmet bedeli ise kampanya planı, kurulum, optimizasyon, raporlama ve danışmanlık için alınır.

Bütçenizi veriye göre planlamak için [Meta reklam yönetimi](/hizmetler/meta-reklam-yonetimi) üzerinden destek alabilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'instagram-reklamlari'), 'Instagram reklam fiyatları', array['Instagram reklam bütçesi','Instagram reklamı kaç TL','reklam bütçesi ne kadar olmalı'], 'Fiyat araştırma', 'Türkiye', 'Instagram Reklam Fiyatları ve Bütçe Planı', 'Instagram reklam fiyatlarını etkileyen faktörleri ve küçük işletmeler için reklam bütçesi belirleme yaklaşımını öğrenin.', false, true, '2026-07-15 09:00:00+00'::timestamptz, 5, 820, 84, 85, 86, 84),
  ('Google Reklamı Nasıl Verilir? Küçük İşletmeler İçin Google Ads Rehberi', 'google-reklami-nasil-verilir-kucuk-isletmeler-icin-google-ads-rehberi', 'Google reklamı vermek isteyen küçük işletmeler için arama niyeti, anahtar kelime, bütçe ve dönüşüm takibini anlatan sade Google Ads rehberi.', '# Google Reklamı Nasıl Verilir? Küçük İşletmeler İçin Google Ads Rehberi

Google reklamları, ihtiyacını aktif şekilde arayan kullanıcılarla buluşmak için güçlü bir kanaldır.

## Anahtar kelime seçimi
Bilgi amaçlı aramalar ile satın alma niyetli aramalar ayrılmalıdır.

Google Ads kampanyalarınızı doğru kurgulamak için [Google Ads yönetimi](/hizmetler/google-ads-yonetimi) sayfamızı inceleyebilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'google-reklamlari'), 'Google reklamı nasıl verilir', array['Google reklam verme','Google Ads nasıl çalışır','Google reklam ajansı'], 'Bilgi edinme + ticari araştırma', 'Türkiye, Manisa', 'Google Reklamı Nasıl Verilir? | HK Dijital', 'Küçük işletmeler için Google Ads başlangıç rehberi: anahtar kelime, reklam metni, bütçe ve dönüşüm takibi.', true, true, '2026-07-15 09:00:00+00'::timestamptz, 6, 920, 87, 85, 88, 86),
  ('Google Reklam Fiyatları ve Aylık Bütçe Nasıl Hesaplanır?', 'google-reklam-fiyatlari-ve-aylik-butce-nasil-hesaplanir', 'Google reklam bütçesini sabit fiyat yerine sektör, kelime niyeti, lokasyon, dönüşüm oranı ve satış değeriyle hesaplama yaklaşımı.', '# Google Reklam Fiyatları ve Aylık Bütçe Nasıl Hesaplanır?

Google reklam fiyatları aranan kelimeye, rekabete, lokasyona ve reklam kalitesine göre değişir.

## Tıklama maliyeti tek başına yeterli değildir
Ucuz tıklama her zaman iyi değildir. Önemli olan tıklamanın talebe ve satış fırsatına dönüşmesidir.

Google reklam bütçenizi iş hedefinize göre planlamak için [ücretsiz ön görüşme](/teklif-al) alabilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'google-reklamlari'), 'Google reklam fiyatları', array['Google reklam bütçesi','Google reklamı kaç TL','Google Ads uzmanı'], 'Fiyat araştırma', 'Türkiye', 'Google Reklam Fiyatları ve Bütçe Hesabı', 'Google reklam fiyatlarını etkileyen faktörleri ve aylık reklam bütçesi hesaplama yaklaşımını öğrenin.', false, true, '2026-07-15 09:00:00+00'::timestamptz, 5, 780, 84, 84, 86, 83),
  ('Google Reklamı mı Instagram Reklamı mı? İşletmeniz İçin Doğru Kanal', 'google-reklami-mi-instagram-reklami-mi', 'Google Ads ve Instagram reklamlarını niyet, bütçe, satış süreci ve sektör açısından karşılaştıran karar rehberi.', '# Google Reklamı mı Instagram Reklamı mı? İşletmeniz İçin Doğru Kanal

Google ve Instagram aynı problemi çözmez. Google aktif arama niyeti güçlü kullanıcıya ulaşır. Instagram ise ihtiyaç farkındalığı oluşturmak ve görsel anlatım yapmak için güçlüdür.

## İkisini birlikte kullanmak
Instagram farkındalık ve talep oluşturur; Google arama niyetini yakalar.

Kanal seçimi için [dijital pazarlama danışmanlığı](/hizmetler/dijital-pazarlama-danismanligi) kapsamında reklam hedeflerinizi birlikte değerlendirebiliriz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'reklam-stratejisi'), 'Google reklamı mı Instagram reklamı mı', array['Google Ads mi Meta Ads mi','Facebook reklamı mı Instagram reklamı mı','reklam kanalı seçimi'], 'Karşılaştırma', 'Türkiye', 'Google Reklamı mı Instagram Reklamı mı?', 'Google Ads ve Instagram reklamlarını kullanıcı niyeti, bütçe, sektör ve satış sürecine göre karşılaştırın.', false, true, '2026-07-15 09:00:00+00'::timestamptz, 5, 760, 85, 86, 88, 85),
  ('Reklam Veriyorum Ama Satış Olmuyor: Sorun Reklamda mı, Satış Sürecinde mi?', 'reklam-veriyorum-ama-satis-olmuyor', 'Reklam talep getiriyor ama satış kapanmıyorsa reklam, teklif, güven ve takip sürecini birlikte değerlendiren kontrol rehberi.', '# Reklam Veriyorum Ama Satış Olmuyor: Sorun Reklamda mı, Satış Sürecinde mi?

Reklamdan mesaj geliyor ama satış olmuyorsa sorun yalnız reklam panelinde olmayabilir. Reklam talep üretir; satış ise güven, teklif, hız ve takip süreciyle tamamlanır.

## Ölçüm zinciri kurun
Reklam tıklaması, mesaj, teklif, takip ve satış aşamalarını ayrı ayrı ölçün.

Reklam ve satış sürecini birlikte değerlendirmek için [ücretsiz ön görüşme](/teklif-al) talep edebilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'reklam-stratejisi'), 'reklam veriyorum ama satış olmuyor', array['reklam bütçem boşa gidiyor','mesaj geliyor satış olmuyor','reklam dönüşümü'], 'Sorun çözme', 'Türkiye', 'Reklam Veriyorum Ama Satış Olmuyor', 'Reklam mesaj getiriyor ama satış olmuyorsa reklam, teklif, güven ve satış sürecindeki olası sorunları kontrol edin.', false, true, '2026-07-15 09:00:00+00'::timestamptz, 5, 760, 85, 87, 88, 86),
  ('Küçük İşletmeler İnternetten Nasıl Müşteri Bulabilir?', 'kucuk-isletmeler-internetten-nasil-musteri-bulabilir', 'Küçük ve yerel işletmeler için internetten müşteri bulmanın reklam, sosyal medya, Google görünürlüğü ve takip süreciyle ilişkisini anlatan rehber.', '# Küçük İşletmeler İnternetten Nasıl Müşteri Bulabilir?

Küçük işletmeler için internetten müşteri bulmak yalnız reklam vermek değildir. Google’da bulunabilir olmak, sosyal medyada güven vermek, doğru teklif sunmak ve gelen talebi takip etmek birlikte çalışır.

## Sosyal medya güven alanıdır
Her paylaşım satış amaçlı olmak zorunda değildir. Hizmeti, süreci, gerçek ekibi ve sık soruları anlatmak güven oluşturur.

Manisa merkezli veya Türkiye geneline hizmet veren işletmeniz için [dijital pazarlama hizmetlerimizi](/hizmetler) inceleyebilirsiniz.', 'published', 'Hayri Kamalı', (select id from public.blog_categories where slug = 'kucuk-isletmeler'), 'internetten müşteri bulmak', array['küçük işletme reklamı','yerel işletme reklamı','sosyal medyadan müşteri bulmak'], 'Genel ihtiyaç', 'Türkiye, Manisa', 'Küçük İşletmeler İnternetten Nasıl Müşteri Bulur?', 'Küçük işletmeler için Google, sosyal medya, reklam ve takip süreciyle internetten müşteri bulma rehberi.', false, true, '2026-07-15 09:00:00+00'::timestamptz, 5, 760, 84, 88, 88, 85)
) as seed(title, slug, excerpt, content, status, author_name, category_id, primary_keyword, secondary_keywords, search_intent, target_location, meta_title, meta_description, featured, allow_indexing, published_at, reading_time, word_count, seo_score, readability_score, clarity_score, content_quality_score)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
