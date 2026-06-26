-- Equipd Order Handover — Phase 4A foundation (structured fulfilment details)
-- Run after buyer-protection-phase4c-dispute-admin-resolution.sql
-- Safe to re-run (idempotent where possible).
--
-- Stores collection contact/location details for paid orders so buyers and sellers
-- do not need to exchange addresses or phone numbers through unrestricted chat.
-- UI is out of scope for this migration.
--
-- Field ownership:
--   Seller: seller_collection_address, seller_phone, parking_loading_notes
--   Buyer:  buyer_phone, preferred_collection_time
--   Both:   additional_notes
--
-- Future columns (reserved, not yet editable by participants):
--   buyer_delivery_address, courier_notes, handover_qr_prepared_at, handover_checklist

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_order_handover_participant(
  p_order_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (o.buyer_id = p_user_id or o.seller_id = p_user_id)
  );
$$;

revoke all on function public.is_order_handover_participant(uuid, uuid) from public;
grant execute on function public.is_order_handover_participant(uuid, uuid) to authenticated;

create or replace function public.order_handover_details_order_writable(p_order_id uuid)
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
      and p.status = 'paid'::public.payment_status
      and o.fulfilment_status <> 'cancelled'::public.order_fulfilment_status
  );
$$;

revoke all on function public.order_handover_details_order_writable(uuid) from public;
grant execute on function public.order_handover_details_order_writable(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- order_handover_details
-- ---------------------------------------------------------------------------

create table if not exists public.order_handover_details (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  seller_collection_address text,
  seller_phone text,
  buyer_phone text,
  preferred_collection_time text,
  parking_loading_notes text,
  additional_notes text,
  -- Reserved for later phases (courier delivery, QR readiness, checklist, etc.)
  buyer_delivery_address text,
  courier_notes text,
  handover_qr_prepared_at timestamptz,
  handover_checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_handover_details_order_unique unique (order_id)
);

comment on table public.order_handover_details is
  'Structured fulfilment contact/location details for a paid order (1:1 with orders).';

comment on column public.order_handover_details.seller_collection_address is
  'Seller-only: collection address or meeting point for in-person handover.';

comment on column public.order_handover_details.seller_phone is
  'Seller-only: seller contact number for fulfilment coordination.';

comment on column public.order_handover_details.buyer_phone is
  'Buyer-only: buyer contact number for fulfilment coordination.';

comment on column public.order_handover_details.preferred_collection_time is
  'Buyer-only: free-text preferred collection / handover window.';

comment on column public.order_handover_details.parking_loading_notes is
  'Seller-only: parking, loading bay, or access instructions.';

comment on column public.order_handover_details.additional_notes is
  'Editable by buyer and seller: shared fulfilment notes.';

comment on column public.order_handover_details.buyer_delivery_address is
  'Reserved: buyer delivery address for courier fulfilment (future phase).';

comment on column public.order_handover_details.courier_notes is
  'Reserved: courier-specific instructions (future phase).';

comment on column public.order_handover_details.handover_qr_prepared_at is
  'Reserved: when seller marked QR/handover readiness (future phase).';

comment on column public.order_handover_details.handover_checklist is
  'Reserved: structured checklist state, e.g. {"buyer_phone_confirmed": true} (future phase).';

create index if not exists order_handover_details_order_id_idx
  on public.order_handover_details (order_id);

drop trigger if exists order_handover_details_set_updated_at on public.order_handover_details;

create trigger order_handover_details_set_updated_at
  before update on public.order_handover_details
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Column-level permissions (buyer vs seller field ownership)
-- ---------------------------------------------------------------------------

create or replace function public.enforce_order_handover_details_permissions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_buyer_id uuid;
  v_seller_id uuid;
  v_is_buyer boolean;
  v_is_seller boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select o.buyer_id, o.seller_id
  into v_buyer_id, v_seller_id
  from public.orders o
  where o.id = coalesce(NEW.order_id, OLD.order_id);

  if not found then
    raise exception 'Order not found';
  end if;

  v_is_buyer := v_uid = v_buyer_id;
  v_is_seller := v_uid = v_seller_id;

  if not v_is_buyer and not v_is_seller then
    raise exception 'Only the buyer or seller may change handover details for this order';
  end if;

  if TG_OP = 'INSERT' then
    if not public.order_handover_details_order_writable(NEW.order_id) then
      raise exception 'Handover details cannot be added for this order yet';
    end if;

    if NEW.buyer_delivery_address is not null
       or NEW.courier_notes is not null
       or NEW.handover_qr_prepared_at is not null
       or coalesce(NEW.handover_checklist, '{}'::jsonb) <> '{}'::jsonb then
      raise exception 'Reserved handover fields are not yet available';
    end if;

    if v_is_seller then
      if NEW.buyer_phone is not null or NEW.preferred_collection_time is not null then
        raise exception 'Sellers cannot set buyer-only handover fields on create';
      end if;
    end if;

    if v_is_buyer then
      if NEW.seller_collection_address is not null
         or NEW.seller_phone is not null
         or NEW.parking_loading_notes is not null then
        raise exception 'Buyers cannot set seller-only handover fields on create';
      end if;
    end if;

    return NEW;
  end if;

  if not public.order_handover_details_order_writable(OLD.order_id) then
    raise exception 'Handover details cannot be changed for this order';
  end if;

  if NEW.id is distinct from OLD.id or NEW.order_id is distinct from OLD.order_id then
    raise exception 'Cannot reassign handover details';
  end if;

  if NEW.buyer_delivery_address is distinct from OLD.buyer_delivery_address
     or NEW.courier_notes is distinct from OLD.courier_notes
     or NEW.handover_qr_prepared_at is distinct from OLD.handover_qr_prepared_at
     or NEW.handover_checklist is distinct from OLD.handover_checklist then
    raise exception 'Reserved handover fields are not yet editable';
  end if;

  if v_is_seller and not v_is_buyer then
    if NEW.buyer_phone is distinct from OLD.buyer_phone
       or NEW.preferred_collection_time is distinct from OLD.preferred_collection_time then
      raise exception 'Sellers cannot edit buyer-only handover fields';
    end if;
  end if;

  if v_is_buyer and not v_is_seller then
    if NEW.seller_collection_address is distinct from OLD.seller_collection_address
       or NEW.seller_phone is distinct from OLD.seller_phone
       or NEW.parking_loading_notes is distinct from OLD.parking_loading_notes then
      raise exception 'Buyers cannot edit seller-only handover fields';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists order_handover_details_enforce_permissions_insert
  on public.order_handover_details;

create trigger order_handover_details_enforce_permissions_insert
  before insert on public.order_handover_details
  for each row execute function public.enforce_order_handover_details_permissions();

drop trigger if exists order_handover_details_enforce_permissions_update
  on public.order_handover_details;

create trigger order_handover_details_enforce_permissions_update
  before update on public.order_handover_details
  for each row execute function public.enforce_order_handover_details_permissions();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.order_handover_details enable row level security;

drop policy if exists "Order participants can read handover details"
  on public.order_handover_details;

create policy "Order participants can read handover details"
  on public.order_handover_details for select
  to authenticated
  using (public.is_order_handover_participant(order_id));

drop policy if exists "Admins can read all order handover details"
  on public.order_handover_details;

create policy "Admins can read all order handover details"
  on public.order_handover_details for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Order participants can insert handover details"
  on public.order_handover_details;

create policy "Order participants can insert handover details"
  on public.order_handover_details for insert
  to authenticated
  with check (
    public.is_order_handover_participant(order_id)
    and public.order_handover_details_order_writable(order_id)
  );

drop policy if exists "Order participants can update handover details"
  on public.order_handover_details;

create policy "Order participants can update handover details"
  on public.order_handover_details for update
  to authenticated
  using (
    public.is_order_handover_participant(order_id)
    and public.order_handover_details_order_writable(order_id)
  )
  with check (
    public.is_order_handover_participant(order_id)
    and public.order_handover_details_order_writable(order_id)
  );

-- No delete policy: participants cannot remove handover rows.
-- service_role / future admin RPCs may manage lifecycle if needed.

revoke all on table public.order_handover_details from public;
grant select, insert, update on table public.order_handover_details to authenticated;
