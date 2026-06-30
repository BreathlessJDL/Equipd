-- Admin read access for order-evidence bucket (see admin-order-evidence-storage.sql)

create or replace function public.storage_admin_can_read_order_evidence(
  p_order_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    and exists (
      select 1
      from public.orders o
      where o.id = p_order_id
    );
$$;

revoke all on function public.storage_admin_can_read_order_evidence(uuid) from public;
grant execute on function public.storage_admin_can_read_order_evidence(uuid) to authenticated;

drop policy if exists "Admins can read order evidence" on storage.objects;

create policy "Admins can read order evidence"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-evidence'
    and public.storage_admin_can_read_order_evidence(
      ((storage.foldername(name))[1])::uuid
    )
  );

notify pgrst, 'reload schema';
