-- Dijital Pazarlama Ön Analizi: structured answers that have no dedicated
-- leads column yet (content need, start timing, current social media status).
-- Additive and nullable: existing leads keep NULL and render as "Belirtilmedi".
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS pre_analysis jsonb NULL;
