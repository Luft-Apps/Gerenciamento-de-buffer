-- Execute uma vez no SQL Editor para atualizar um banco já configurado.
-- Todas as contas autenticadas compartilham o buffer e podem alterar suas ondas.
begin;
alter table public.buffer_state enable row level security;
alter table public.buffer_withdrawals enable row level security;

alter policy buffer_state_read on public.buffer_state
to authenticated using ((select auth.uid()) is not null);
alter policy buffer_state_write on public.buffer_state
to authenticated using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
alter policy buffer_withdrawals_read on public.buffer_withdrawals
to authenticated using (expires_at > now() and (select auth.uid()) is not null);
alter policy buffer_withdrawals_insert on public.buffer_withdrawals
to authenticated with check (withdrawn_by = (select auth.uid()));

revoke all on public.buffer_state, public.buffer_withdrawals from anon, authenticated;
grant select on public.buffer_state, public.buffer_withdrawals to authenticated;
grant update (pallets, revision, updated_at) on public.buffer_state to authenticated;
grant insert (address, wave) on public.buffer_withdrawals to authenticated;
revoke all on function public.buffer_commit(jsonb, bigint, text) from public, anon;
grant execute on function public.buffer_commit(jsonb, bigint, text) to authenticated;
commit;

-- Confirme que nenhuma das quatro políticas depende de buffer_members:
select tablename, policyname, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in ('buffer_state', 'buffer_withdrawals');
