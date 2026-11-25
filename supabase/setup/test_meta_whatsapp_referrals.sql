create table public.test_meta_whatsapp_referrals (
  message_id text primary key check (message_id ~ '^wamid\\.[A-Za-z0-9_+/=-]{1,249}$'),
  ad_id text not null check (ad_id ~ '^[0-9]{1,32}$'),
  received_at timestamptz not null default now()
);

alter table public.test_meta_whatsapp_referrals enable row level security;
revoke all on public.test_meta_whatsapp_referrals from public, anon, authenticated;
grant select, insert on public.test_meta_whatsapp_referrals to service_role;
notify pgrst, 'reload schema';
