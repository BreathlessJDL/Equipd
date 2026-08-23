-- Read-only admin conversation inspection.
-- Does not widen participant messaging RLS. Admins read via SECURITY DEFINER RPCs
-- that check public.is_admin() before returning data.
-- Opening a conversation writes an access audit row without message bodies.

create table if not exists public.admin_conversation_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  action text not null default 'conversation_viewed',
  created_at timestamptz not null default now(),
  constraint admin_conversation_access_log_action_valid check (action = 'conversation_viewed')
);

create index if not exists admin_conversation_access_log_admin_created_idx
  on public.admin_conversation_access_log (admin_user_id, created_at desc);

create index if not exists admin_conversation_access_log_conversation_created_idx
  on public.admin_conversation_access_log (conversation_id, created_at desc);

alter table public.admin_conversation_access_log enable row level security;

revoke all on table public.admin_conversation_access_log from public, anon, authenticated;

create or replace function public.admin_conversation_participant_payload(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_user_id is null then null
    when p.id is null then jsonb_build_object(
      'id', p_user_id,
      'deleted', true,
      'username', null,
      'displayName', null,
      'avatarUrl', null
    )
    else jsonb_build_object(
      'id', p.id,
      'deleted', false,
      'username', p.username,
      'displayName', p.display_name,
      'avatarUrl', p.avatar_url
    )
  end
  from (select p_user_id as id) req
  left join public.profiles p on p.id = req.id;
$$;

revoke all on function public.admin_conversation_participant_payload(uuid) from public, anon, authenticated;

create or replace function public.admin_list_conversations(
  p_query text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_limit integer;
  v_offset integer;
  v_raw text;
  v_like text;
  v_uuid uuid;
  v_total integer;
  v_items jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 40), 50));
  v_offset := greatest(0, coalesce(p_offset, 0));
  v_raw := nullif(btrim(coalesce(p_query, '')), '');

  if v_raw is not null
    and v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_uuid := v_raw::uuid;
  end if;

  if v_raw is not null then
    v_like := '%' || replace(replace(replace(v_raw, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with matched as (
    select distinct c.id
    from public.conversations c
    left join public.listings l on l.id = c.listing_id
    left join public.profiles bp on bp.id = c.buyer_id
    left join public.profiles sp on sp.id = c.seller_id
    left join auth.users bu on bu.id = c.buyer_id
    left join auth.users su on su.id = c.seller_id
    where v_raw is null
      or c.id = v_uuid
      or l.title ilike v_like escape '\'
      or bp.username ilike v_like escape '\'
      or bp.display_name ilike v_like escape '\'
      or sp.username ilike v_like escape '\'
      or sp.display_name ilike v_like escape '\'
      or bu.email ilike v_like escape '\'
      or su.email ilike v_like escape '\'
  ),
  listed as (
    select
      c.updated_at as row_updated_at,
      jsonb_build_object(
        'id', c.id,
        'createdAt', c.created_at,
        'updatedAt', c.updated_at,
        'listing', case
          when l.id is null then null
          else jsonb_build_object(
            'id', l.id,
            'title', l.title,
            'slug', l.slug,
            'status', l.status,
            'pricePence', l.price_pence,
            'imagePath', img.storage_path,
            'public', (l.status in ('active', 'sold') and l.slug is not null)
          )
        end,
        'buyer', public.admin_conversation_participant_payload(c.buyer_id),
        'seller', public.admin_conversation_participant_payload(c.seller_id),
        'lastMessage', case
          when lm.id is null then null
          else jsonb_build_object(
            'id', lm.id,
            'body', lm.body,
            'messageType', lm.message_type,
            'createdAt', lm.created_at,
            'senderId', lm.sender_id,
            'attachmentCount', coalesce(lm.attachment_count, 0)
          )
        end
      ) as row_payload
    from public.conversations c
    join matched m on m.id = c.id
    left join public.listings l on l.id = c.listing_id
    left join lateral (
      select li.storage_path
      from public.listing_images li
      where li.listing_id = l.id
      order by li.sort_order asc, li.created_at asc
      limit 1
    ) img on true
    left join lateral (
      select
        msg.id,
        msg.body,
        msg.message_type,
        msg.created_at,
        msg.sender_id,
        (
          select count(*)::integer
          from public.message_attachments ma
          where ma.message_id = msg.id
        ) as attachment_count
      from public.messages msg
      where msg.conversation_id = c.id
      order by msg.created_at desc
      limit 1
    ) lm on true
    order by c.updated_at desc
    limit v_limit
    offset v_offset
  )
  select
    (select count(*)::integer from matched),
    coalesce(jsonb_agg(row_payload order by row_updated_at desc), '[]'::jsonb)
  into v_total, v_items
  from listed;

  return jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

create or replace function public.admin_get_conversation(
  p_conversation_id uuid,
  p_before timestamptz default null,
  p_limit integer default 80
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_conversation public.conversations;
  v_listing jsonb;
  v_messages jsonb;
  v_has_more boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_conversation_id is null then
    raise exception 'Conversation id is required';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 80), 100));

  select *
  into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    return jsonb_build_object('conversation', null, 'messages', '[]'::jsonb, 'hasMore', false);
  end if;

  if p_before is null then
    insert into public.admin_conversation_access_log (admin_user_id, conversation_id, action)
    values (auth.uid(), p_conversation_id, 'conversation_viewed');
  end if;

  select case
    when l.id is null then null
    else jsonb_build_object(
      'id', l.id,
      'title', l.title,
      'slug', l.slug,
      'status', l.status,
      'pricePence', l.price_pence,
      'imagePath', img.storage_path,
      'public', (l.status in ('active', 'sold') and l.slug is not null)
    )
  end
  into v_listing
  from public.listings l
  left join lateral (
    select li.storage_path
    from public.listing_images li
    where li.listing_id = l.id
    order by li.sort_order asc, li.created_at asc
    limit 1
  ) img on true
  where l.id = v_conversation.listing_id;

  with page as (
    select
      msg.id,
      msg.body,
      msg.message_type,
      msg.created_at,
      msg.sender_id,
      msg.offer_id,
      (
        select coalesce(jsonb_agg(att order by display_order), '[]'::jsonb)
        from (
          select jsonb_build_object(
            'id', ma.id,
            'storage_path', ma.storage_path,
            'mime_type', ma.mime_type,
            'file_size_bytes', ma.file_size_bytes,
            'image_width', ma.image_width,
            'image_height', ma.image_height,
            'display_order', ma.display_order
          ) as att,
          ma.display_order
          from public.message_attachments ma
          where ma.message_id = msg.id
        ) attachments
      ) as attachments,
      case
        when o.id is null then null
        else jsonb_build_object(
          'id', o.id,
          'amountPence', o.amount_pence,
          'quantity', o.quantity,
          'status', o.status,
          'direction', o.direction
        )
      end as offer
    from public.messages msg
    left join public.offers o on o.id = msg.offer_id
    where msg.conversation_id = p_conversation_id
      and (p_before is null or msg.created_at < p_before)
    order by msg.created_at desc
    limit v_limit + 1
  ),
  trimmed as (
    select *
    from page
    order by created_at desc
    limit v_limit
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', trimmed.id,
          'body', trimmed.body,
          'messageType', trimmed.message_type,
          'createdAt', trimmed.created_at,
          'senderId', trimmed.sender_id,
          'offerId', trimmed.offer_id,
          'attachments', trimmed.attachments,
          'offer', trimmed.offer
        )
        order by trimmed.created_at asc
      ),
      '[]'::jsonb
    ),
    (select count(*) > v_limit from page)
  into v_messages, v_has_more
  from trimmed;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id,
      'createdAt', v_conversation.created_at,
      'updatedAt', v_conversation.updated_at,
      'listing', v_listing,
      'buyer', public.admin_conversation_participant_payload(v_conversation.buyer_id),
      'seller', public.admin_conversation_participant_payload(v_conversation.seller_id)
    ),
    'messages', coalesce(v_messages, '[]'::jsonb),
    'hasMore', coalesce(v_has_more, false)
  );
end;
$$;

revoke all on function public.admin_list_conversations(text, integer, integer) from public, anon;
revoke all on function public.admin_get_conversation(uuid, timestamptz, integer) from public, anon;
grant execute on function public.admin_list_conversations(text, integer, integer) to authenticated;
grant execute on function public.admin_get_conversation(uuid, timestamptz, integer) to authenticated;

drop policy if exists "Admins can read message attachment images" on storage.objects;
create policy "Admins can read message attachment images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'message-attachments'
    and public.is_admin()
  );

notify pgrst, 'reload schema';
