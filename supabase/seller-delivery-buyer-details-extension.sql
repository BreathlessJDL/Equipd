-- Seller delivery: full buyer delivery contact details + writable-until-handover guard
-- Run after fulfilment-architecture-phase1-schema.sql

-- ---------------------------------------------------------------------------
-- order_delivery_details — additional buyer contact fields
-- ---------------------------------------------------------------------------

alter table public.order_delivery_details
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_phone text,
  add column if not exists delivery_notes text,
  add column if not exists delivery_details_submitted_at timestamptz;

comment on column public.order_delivery_details.delivery_contact_name is
  'Buyer contact name for seller delivery coordination.';

comment on column public.order_delivery_details.delivery_contact_phone is
  'Buyer contact phone for seller delivery coordination.';

comment on column public.order_delivery_details.delivery_notes is
  'Optional delivery notes or access instructions from the buyer.';

comment on column public.order_delivery_details.delivery_details_submitted_at is
  'Timestamp when buyer first saved complete delivery details for this order.';

-- ---------------------------------------------------------------------------
-- Writable only while awaiting seller delivery (before handover QR confirmation)
-- ---------------------------------------------------------------------------

create or replace function public.is_seller_delivery_order_writable(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    join public.payments p on p.id = o.payment_id
    where o.id = p_order_id
      and coalesce(o.order_type, 'collection'::public.order_type)
        = 'seller_delivery'::public.order_type
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status in (
        'awaiting_seller_delivery'::public.order_fulfilment_status,
        'paid'::public.order_fulfilment_status
      )
      and o.collected_at is null
      and o.collection_confirmed_at is null
  );
$$;

revoke all on function public.is_seller_delivery_order_writable(uuid) from public;
grant execute on function public.is_seller_delivery_order_writable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Set delivery_details_submitted_at on first complete save
-- ---------------------------------------------------------------------------

create or replace function public.set_order_delivery_details_submitted_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.delivery_details_submitted_at is null
       and nullif(trim(coalesce(NEW.buyer_delivery_address, '')), '') is not null
       and nullif(trim(coalesce(NEW.delivery_contact_name, '')), '') is not null
       and nullif(trim(coalesce(NEW.delivery_contact_phone, '')), '') is not null then
      NEW.delivery_details_submitted_at := now();
    end if;
  elsif TG_OP = 'UPDATE' then
    if NEW.delivery_details_submitted_at is null
       and nullif(trim(coalesce(NEW.buyer_delivery_address, '')), '') is not null
       and nullif(trim(coalesce(NEW.delivery_contact_name, '')), '') is not null
       and nullif(trim(coalesce(NEW.delivery_contact_phone, '')), '') is not null then
      NEW.delivery_details_submitted_at := coalesce(OLD.delivery_details_submitted_at, now());
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists order_delivery_details_set_submitted_at on public.order_delivery_details;

create trigger order_delivery_details_set_submitted_at
  before insert or update on public.order_delivery_details
  for each row execute function public.set_order_delivery_details_submitted_at();
