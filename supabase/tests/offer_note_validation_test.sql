-- Staging SQL: offer-note server enforcement and deletion follow-up objects.
-- Do not apply to production from this change set. Run after
-- 20261030130000_offer_notes_deletion_retention.sql on a staging database.

do $$
begin
  if to_regprocedure('public.create_buyer_offer(uuid,uuid,integer,integer,text)') is null then
    raise exception 'FAIL: create_buyer_offer(uuid,uuid,integer,integer,text) missing';
  end if;

  if to_regprocedure('public.create_buyer_offer(uuid,uuid,integer,text)') is not null then
    raise exception 'FAIL: legacy create_buyer_offer without quantity must stay dropped';
  end if;

  if to_regprocedure('public.counter_offer(uuid,integer)') is null then
    raise exception 'FAIL: counter_offer(uuid,integer) missing';
  end if;

  if to_regprocedure('public.assert_marketplace_offer_note_allowed(text,uuid,uuid)') is null then
    raise exception 'FAIL: assert_marketplace_offer_note_allowed missing';
  end if;

  if to_regprocedure('public.begin_account_deletion(uuid)') is null then
    raise exception 'FAIL: begin_account_deletion missing';
  end if;

  if to_regprocedure('public.list_account_media_cleanup_targets(uuid)') is null then
    raise exception 'FAIL: list_account_media_cleanup_targets missing';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.assert_marketplace_offer_note_allowed(
      'Call me on 07712345678',
      null,
      null
    );
    raise exception 'FAIL: phone offer note was accepted';
  exception
    when others then
      if sqlerrm not ilike '%keep phone numbers on Equipd%'
         and sqlerrm not ilike '%keep communication and payments on Equipd%' then
        raise exception 'FAIL: unexpected phone-note error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.assert_marketplace_offer_note_allowed(
      'email me at buyer@gmail.com',
      null,
      null
    );
    raise exception 'FAIL: email offer note was accepted';
  exception
    when others then
      if sqlerrm not ilike '%keep communication and payments on Equipd%' then
        raise exception 'FAIL: unexpected email-note error: %', sqlerrm;
      end if;
  end;

  begin
    perform public.assert_marketplace_offer_note_allowed(
      'https://example.com/deal',
      null,
      null
    );
    raise exception 'FAIL: URL offer note was accepted';
  exception
    when others then
      if sqlerrm not ilike '%keep communication and payments on Equipd%' then
        raise exception 'FAIL: unexpected URL-note error: %', sqlerrm;
      end if;
  end;

  if public.assert_marketplace_offer_note_allowed('Happy to collect Saturday', null, null)
     is distinct from 'Happy to collect Saturday' then
    raise exception 'FAIL: ordinary offer note should be stored trimmed';
  end if;

  if public.assert_marketplace_offer_note_allowed('   ', null, null) is not null then
    raise exception 'FAIL: blank offer notes should store as null';
  end if;
end;
$$;

select 'PASS offer note validation SQL checks' as result;
