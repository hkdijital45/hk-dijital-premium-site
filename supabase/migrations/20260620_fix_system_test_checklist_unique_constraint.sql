alter table if exists public.system_test_checklist
  add column if not exists item_key text;

with ranked_checklist as (
  select
    id,
    row_number() over (
      partition by item_key
      order by
        case when deleted_at is null then 0 else 1 end,
        coalesce(last_tested_at, updated_at, created_at, now()) desc,
        id desc
    ) as row_rank
  from public.system_test_checklist
  where item_key is not null
)
delete from public.system_test_checklist checklist
using ranked_checklist ranked
where checklist.id = ranked.id
  and ranked.row_rank > 1;

drop index if exists public.system_test_checklist_item_key_idx;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'system_test_checklist_item_key_unique'
      and conrelid = 'public.system_test_checklist'::regclass
  ) then
    alter table public.system_test_checklist
      add constraint system_test_checklist_item_key_unique
      unique (item_key);
  end if;
end $$;
