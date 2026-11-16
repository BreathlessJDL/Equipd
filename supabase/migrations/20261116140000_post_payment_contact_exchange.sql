-- Expand paid-order message unlock from phone numbers to contact details
-- needed for collection/delivery (email, address, postcode).
-- Authoritative check remains conversation_allows_phone_exchange():
-- verified payments.status = 'paid' for this listing + buyer + seller.
-- Off-platform payment and social apps stay blocked after payment.

create or replace function public.conversation_allows_phone_exchange(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  if p_conversation_id is null or p_user_id is null then
    return false;
  end if;

  if auth.role() is distinct from 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_user_id then
      return false;
    end if;
  end if;

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return false;
  end if;

  if p_user_id is distinct from v_conversation.buyer_id
     and p_user_id is distinct from v_conversation.seller_id then
    return false;
  end if;

  return exists (
    select 1
    from public.orders o
    join public.payments pay on pay.id = o.payment_id
    where o.listing_id = v_conversation.listing_id
      and o.buyer_id = v_conversation.buyer_id
      and o.seller_id = v_conversation.seller_id
      and (p_user_id = o.buyer_id or p_user_id = o.seller_id)
      and pay.status = 'paid'::public.payment_status
      and o.fulfilment_status::text not in ('cancelled', 'refunded')
  );
end;
$$;

revoke all on function public.conversation_allows_phone_exchange(uuid, uuid) from public;
grant execute on function public.conversation_allows_phone_exchange(uuid, uuid) to authenticated, service_role;

create or replace function public.marketplace_message_phone_block_message()
returns text
language sql
immutable
as $$
  select 'Please keep contact details on Equipd until payment is confirmed. Once this order is paid, you can share phone numbers, emails and collection or delivery details in this conversation.';
$$;

create or replace function public.marketplace_message_is_blocked(
  p_body text,
  p_allow_phone boolean default false
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_text text := coalesce(trim(p_body), '');
  v_scan text;
  v_price_context boolean;
  v_skip_location_rules boolean;
  v_allow_contact boolean := coalesce(p_allow_phone, false);
begin
  if v_text = '' then
    return true;
  end if;

  if v_text ~* '\y\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|cm|mm|m|metres?|meters?|miles?|mi|hours?|hrs?|hr)\y' then
    return false;
  end if;

  v_price_context := public.marketplace_message_has_price_context(v_text);
  v_skip_location_rules :=
    v_price_context
    and not public.marketplace_message_has_street_terms(v_text)
    and not public.marketplace_message_has_address_intent(v_text);

  v_scan := v_text;
  if v_allow_contact then
    v_scan := regexp_replace(
      v_text,
      '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',
      ' ',
      'gi'
    );
  else
    if v_text ~* '\y[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\y' then
      return true;
    end if;
  end if;

  if v_scan ~* '(?:https?://|www\.)[^\s]+' then
    return true;
  end if;

  if v_scan ~* '\y(?:[a-z0-9-]+\.)+(?:com|co\.uk|net|org|io|me|app)(?:/[^\s]*)?\y' then
    return true;
  end if;

  if not v_allow_contact then
    if v_text ~ '(?:\+?\d[\d\s().-]{7,}\d)' then
      return true;
    end if;
  end if;

  if v_text ~ '(?:^|\s)@[A-Za-z0-9._]{2,}\y' then
    return true;
  end if;

  if v_text ~* '\ywhatsapp\y' then
    return true;
  end if;

  if v_text ~* '\y(?:telegram|signal|instagram|insta|facebook|fb|snapchat|tiktok|twitter|discord)\y' then
    return true;
  end if;

  if not v_allow_contact then
    if v_text ~* '\y(?:email me|message me on|contact me on|add me on|dm me|reach me on)\y' then
      return true;
    end if;
  end if;

  if not v_allow_contact then
    if v_text ~* '\y(?:call me|text me|my number is|phone number|mobile number|send me your number)\y' then
      return true;
    end if;
  end if;

  if v_text ~* '\y(?:pay outside equipd|pay off platform|outside equipd|off platform|direct payment)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:bank transfer|wire transfer|sort code|account number|bacs|faster payment)\y' then
    return true;
  end if;

  if v_text ~* '\y(?:cash on collection|pay cash|pay in cash|cash payment|cash instead|can i pay cash|cash only|cash in hand)\y' then
    return true;
  end if;

  if v_text ~* '(?:£\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?)\s+cash\y' then
    return true;
  end if;

  if v_text ~* '\y(?:paypal(?:\.me)?|venmo)\y' then
    return true;
  end if;

  if not v_skip_location_rules and not v_allow_contact then
    if v_text ~* '\y(?:GIR\s?0AA|[A-Z]{1,2}\d{1,2}[A-Z]?(?:\s+\d[A-Z]{2}|\d[A-Z]{2}))\y' then
      return true;
    end if;

    if v_text ~* '\y(?:(?:flat|unit|apartment)\s+\d+[A-Za-z]?(?:\s*,\s*|\s+)\d+|unit\s+\d+[A-Za-z]?\s*(?:,?\s*)?(?:industrial estate|business park)|(?:unit\s+\d+[A-Za-z]?\s*,?\s*)?(?:industrial estate|business park)|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)*(?:road|avenue|crescent|terrace|high street)\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+street\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+(?:lane|drive|close|court|way|place)\y|\d+[A-Za-z]?\s+(?:[\w''-]+\s+)+(?:rd|st|ave|dr|ln)\y)' then
      return true;
    end if;

    if v_text ~* '\y(?:collect from my (?:house|home|address|place)|come to my (?:house|home|address|place)|(?:i''ll|i will)\s+send (?:you\s+)?my address|meet (?:at|me at)\s+my (?:house|home|address|place)|pick up from|collect at|my postcode is|(?:my\s+)?address is)\y' then
      return true;
    end if;
  end if;

  return false;
end;
$$;

-- Authoritative body check on insert so send_message and
-- send_message_with_attachments cannot diverge if an older RPC is deployed.
create or replace function public.messages_enforce_marketplace_body()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.message_type is distinct from 'text'::public.message_type then
    return new;
  end if;

  if new.sender_id is null then
    return new;
  end if;

  if trim(coalesce(new.body, '')) = '' then
    return new;
  end if;

  new.body := public.assert_marketplace_message_allowed(
    new.body,
    new.conversation_id,
    new.sender_id
  );

  return new;
end;
$$;

revoke all on function public.messages_enforce_marketplace_body() from public;

drop trigger if exists messages_enforce_marketplace_body on public.messages;
create trigger messages_enforce_marketplace_body
  before insert on public.messages
  for each row
  execute function public.messages_enforce_marketplace_body();
