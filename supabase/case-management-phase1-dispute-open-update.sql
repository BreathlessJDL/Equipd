-- Case Management Phase 1 polish: correct initial dispute support update when evidence is submitted.

create or replace function public.trg_order_disputes_case_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message text;
  v_status text;
begin
  v_message := coalesce(
    nullif(trim(NEW.customer_message), ''),
    nullif(trim(NEW.resolution), '')
  );

  if TG_OP = 'INSERT' then
    if coalesce(cardinality(NEW.evidence_paths), 0) >= 1 then
      v_status := 'evidence_received';
      v_message :=
        'Your dispute has been raised and your evidence has been received. Equipd support will review the information provided and contact you if anything else is needed.';
    else
      v_status := 'awaiting_buyer_evidence';
      v_message :=
        'Your dispute has been raised. Please upload supporting evidence so Equipd can review the issue.';
    end if;

    perform public.record_order_case_update(
      NEW.order_id,
      NEW.id,
      null,
      'case_opened',
      v_status,
      v_message,
      null,
      auth.uid()
    );
    return NEW;
  end if;

  if TG_OP = 'UPDATE' then
    if OLD.status is distinct from NEW.status
      or NEW.customer_message is distinct from OLD.customer_message
      or NEW.resolution is distinct from OLD.resolution then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        case
          when OLD.status is distinct from NEW.status then 'admin_decision'
          else 'support_message_update'
        end,
        NEW.status,
        v_message,
        case
          when NEW.admin_note is distinct from OLD.admin_note then NEW.admin_note
          else null
        end,
        auth.uid()
      );
    elsif NEW.admin_note is distinct from OLD.admin_note then
      perform public.record_order_case_update(
        NEW.order_id,
        NEW.id,
        null,
        'admin_note_update',
        NEW.status,
        null,
        NEW.admin_note,
        auth.uid()
      );
    end if;
  end if;

  return NEW;
end;
$$;
