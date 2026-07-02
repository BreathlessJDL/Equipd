-- Fix notify_order_case_update_emails: order_case_updates uses `status`, not `new_status`.
-- Without this fix, any INSERT (e.g. additional_evidence_uploaded) errors when the trigger
-- evaluates the refund_pending branch: record "new" has no field "new_status".

create or replace function public.notify_order_case_update_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dispute_id uuid;
  v_payload jsonb;
begin
  v_dispute_id := new.dispute_id;
  if v_dispute_id is null then
    return new;
  end if;

  v_payload := jsonb_build_object(
    'disputeId', v_dispute_id,
    'orderId', new.order_id,
    'caseUpdateId', new.id
  );

  if new.event_type = 'case_opened' then
    perform public.notify_marketplace_email(
      'dispute_opened',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    perform public.notify_marketplace_email(
      'dispute_opened',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    return new;
  end if;

  if new.event_type = 'admin_decision'
     and new.status in ('awaiting_buyer_evidence', 'awaiting_seller_evidence') then
    perform public.notify_marketplace_email(
      'evidence_requested',
      v_payload || jsonb_build_object(
        'recipientRole',
        case when new.status = 'awaiting_buyer_evidence' then 'buyer' else 'seller' end
      )
    );
    return new;
  end if;

  if new.event_type = 'return_authorised' then
    perform public.notify_marketplace_email(
      'return_authorised',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'return_authorised',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'collection_arranged' then
    perform public.notify_marketplace_email(
      'collection_arranged',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'collection_arranged',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'refund_pending'
     or new.status in ('refund_pending', 'partial_refund_pending') then
    perform public.notify_marketplace_email(
      'refund_pending',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'refund_pending',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'refund_completed' then
    perform public.notify_marketplace_email(
      'refund_completed_case_closed',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'refund_completed_case_closed',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
    return new;
  end if;

  if new.event_type = 'case_closed' then
    if exists (
      select 1
      from public.order_case_updates u
      where u.dispute_id = v_dispute_id
        and u.event_type = 'refund_completed'
        and u.id <> new.id
        and u.created_at >= new.created_at - interval '5 minutes'
    ) then
      return new;
    end if;

    perform public.notify_marketplace_email(
      'case_closed_no_refund',
      v_payload || jsonb_build_object('recipientRole', 'buyer')
    );
    perform public.notify_marketplace_email(
      'case_closed_no_refund',
      v_payload || jsonb_build_object('recipientRole', 'seller')
    );
  end if;

  return new;
end;
$$;
