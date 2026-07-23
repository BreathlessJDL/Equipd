-- Stage 5 sold listing public readability checks.
-- Run against a migration-applied database (service role / postgres).

do $$
declare
  has_sold_at boolean;
  has_readable boolean;
  browse_def text;
  readable_def text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'listings'
      and column_name = 'sold_at'
  ) into has_sold_at;

  if not has_sold_at then
    raise exception 'FAIL: listings.sold_at missing';
  end if;

  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'listing_is_publicly_readable'
  ) into has_readable;

  if not has_readable then
    raise exception 'FAIL: listing_is_publicly_readable missing';
  end if;

  select pg_get_functiondef('public.listing_is_publicly_readable(public.listings)'::regprocedure)
    into readable_def;

  if readable_def is null or position('listing_is_publicly_visible' in readable_def) = 0 then
    raise exception 'FAIL: readability must include visibility branch';
  end if;

  if position('sold_at' in readable_def) = 0 then
    raise exception 'FAIL: readability sold branch must require sold_at';
  end if;

  if position('published_at' in readable_def) = 0 then
    raise exception 'FAIL: readability sold branch must require published_at';
  end if;

  select pg_get_viewdef('public.listings_public_browse'::regclass, true) into browse_def;
  if browse_def is null then
    raise exception 'FAIL: listings_public_browse missing';
  end if;

  if position('listing_is_publicly_visible' in browse_def) = 0 then
    raise exception 'FAIL: browse view must remain visibility-gated';
  end if;

  if position('listing_is_publicly_readable' in browse_def) > 0 then
    raise exception 'FAIL: browse view must not use publicly_readable (would widen marketplace)';
  end if;

  raise notice 'PASS: sold_at + listing_is_publicly_readable present; browse remains active-only';
end $$;

do $$
declare
  active_visible public.listings;
  sold_eligible public.listings;
  sold_never public.listings;
  draft_row public.listings;
  test_row public.listings;
begin
  select l.* into active_visible
  from public.listings l
  where public.listing_is_publicly_visible(l)
  limit 1;

  if active_visible.id is not null then
    if not public.listing_is_publicly_readable(active_visible) then
      raise exception 'FAIL: active public listing must be readable';
    end if;
  else
    raise notice 'SKIP: no active visible listing available for readability check';
  end if;

  select l.* into sold_eligible
  from public.listings l
  where l.status = 'sold'::public.listing_status
    and l.published_at is not null
    and l.sold_at is not null
    and not coalesce(l.is_test_data, false)
  limit 1;

  if sold_eligible.id is not null then
    if not public.listing_is_publicly_readable(sold_eligible) then
      raise exception 'FAIL: eligible sold listing must be readable';
    end if;
    if public.listing_is_publicly_visible(sold_eligible) then
      raise exception 'FAIL: sold listing must not be publicly_visible (browse)';
    end if;
    if sold_eligible.sold_at is null then
      raise exception 'FAIL: eligible sold must retain sold_at';
    end if;
  else
    raise notice 'SKIP: no eligible sold listing for readability check';
  end if;

  select l.* into sold_never
  from public.listings l
  where l.status = 'sold'::public.listing_status
    and l.published_at is null
  limit 1;

  if sold_never.id is not null then
    if public.listing_is_publicly_readable(sold_never) then
      raise exception 'FAIL: never-published sold must not be anonymously readable';
    end if;
  else
    raise notice 'SKIP: no never-published sold row';
  end if;

  select l.* into draft_row
  from public.listings l
  where l.status = 'draft'::public.listing_status
  limit 1;

  if draft_row.id is not null then
    if public.listing_is_publicly_readable(draft_row) then
      raise exception 'FAIL: draft must not be anonymously readable';
    end if;
  else
    raise notice 'SKIP: no draft listing';
  end if;

  select l.* into test_row
  from public.listings l
  where l.is_test_data = true
  limit 1;

  if test_row.id is not null then
    if public.listing_is_publicly_readable(test_row) then
      raise exception 'FAIL: test listing must not be anonymously readable';
    end if;
  else
    raise notice 'SKIP: no test listing';
  end if;

  if exists (
    select 1
    from public.listings_public_browse b
    where b.status = 'sold'::public.listing_status
  ) then
    raise exception 'FAIL: listings_public_browse returned sold rows';
  end if;

  raise notice 'PASS: sold readability matrix + browse active-only';
end $$;
