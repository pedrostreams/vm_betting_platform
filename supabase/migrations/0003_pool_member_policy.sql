-- Fix infinite recursion: the pool_members SELECT policy queried pool_members,
-- which re-triggered the same policy. A SECURITY DEFINER helper bypasses RLS
-- for the membership check, breaking the cycle.

create or replace function is_pool_member(p uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from pool_members where pool_id = p and user_id = auth.uid()
  );
$$;

drop policy if exists pool_members_read on pool_members;
create policy pool_members_read on pool_members for select to authenticated
  using (is_pool_member(pool_id));
