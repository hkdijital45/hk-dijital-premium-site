-- Gelen Talepler: a website contact request is stored in contact_forms and only
-- becomes a Lead when an admin converts it. These two columns record that link.
-- Additive, nullable and non-destructive; existing rows keep NULL.
ALTER TABLE public.contact_forms
  ADD COLUMN IF NOT EXISTS converted_lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz NULL;
