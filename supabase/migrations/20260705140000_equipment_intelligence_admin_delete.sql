-- Equipd Intelligence: admin delete RPCs.
-- Security definer; public RLS unchanged.

create or replace function public.admin_delete_equipment_intelligence(
  p_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_id is null then
    raise exception 'id is required';
  end if;

  delete from public.equipment_intelligence
  where id = p_id;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.admin_delete_all_equipment_intelligence()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  delete from public.equipment_intelligence;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.admin_delete_equipment_intelligence(uuid) from public;
revoke all on function public.admin_delete_all_equipment_intelligence() from public;

grant execute on function public.admin_delete_equipment_intelligence(uuid) to authenticated;
grant execute on function public.admin_delete_all_equipment_intelligence() to authenticated;

notify pgrst, 'reload schema';
