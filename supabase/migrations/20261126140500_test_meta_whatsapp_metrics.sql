create table public.test_meta_whatsapp_metric_events (
  message_hash text not null check (message_hash ~ '^[0-9a-f]{64}$'),
  event_type text not null check (event_type in ('received', 'sent', 'delivered', 'failed')),
  recorded_at timestamptz not null default now(),
  primary key (message_hash, event_type)
);

alter table public.test_meta_whatsapp_metric_events enable row level security;
revoke all on public.test_meta_whatsapp_metric_events from public, anon, authenticated;
grant select, insert on public.test_meta_whatsapp_metric_events to service_role;

create function public.test_meta_whatsapp_metrics()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with messages as (
    select
      bool_or(event_type = 'received') as received,
      bool_or(event_type = 'sent') as sent,
      bool_or(event_type = 'delivered') as delivered,
      bool_or(event_type = 'failed') as failed,
      max(recorded_at) as last_event
    from public.test_meta_whatsapp_metric_events
    group by message_hash
  )
  select jsonb_build_object(
    'received', count(*) filter (where received),
    'awaitingDelivery', count(*) filter (where sent and not delivered and not failed),
    'delivered', count(*) filter (where delivered),
    'failed', count(*) filter (where failed and not delivered),
    'lastEventAt', max(last_event)
  )
  from messages;
$$;

revoke all on function public.test_meta_whatsapp_metrics() from public, anon, authenticated;
grant execute on function public.test_meta_whatsapp_metrics() to service_role;
