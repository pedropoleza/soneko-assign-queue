-- Robustness: don't treat a `kept` decision caused by `no_channel_conversation`
-- (a transient timing race where the channel conversation wasn't queryable yet)
-- as final — let the next scan re-evaluate it once the conversation lands.

create or replace function public.ghl_purge_already(p_contact_id text)
returns boolean
language sql
security definer
set search_path = public, ghl
as $$
  select exists (
    select 1 from ghl.purge_log
    where contact_id = p_contact_id
      and (
        action in ('deleted', 'would_delete')
        or (action = 'kept' and reason is distinct from 'no_channel_conversation')
      )
  );
$$;

revoke all on function public.ghl_purge_already(text) from anon, authenticated;
