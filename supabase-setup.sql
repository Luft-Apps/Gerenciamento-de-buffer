-- Execute no SQL Editor do projeto zysujgsgqemvjoijrkcs.
begin;

create table if not exists public.buffer_state (
    id integer primary key check (id = 1),
    pallets jsonb not null,
    revision bigint not null default 0,
    updated_at timestamptz not null default now()
);
insert into public.buffer_state (id, pallets)
select 1, jsonb_agg(jsonb_build_object('address', chr(c) || r, 'waves', '[]'::jsonb) order by c, r)
from generate_series(65, 76) c cross join generate_series(1, 6) r
on conflict (id) do nothing;

create table if not exists public.buffer_withdrawals (
    id uuid primary key default gen_random_uuid(),
    address text not null check (address ~ '^[A-L][1-6]$'),
    wave jsonb not null,
    withdrawn_by uuid not null default auth.uid() references auth.users(id),
    withdrawn_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '2 hours')
);
create index if not exists buffer_withdrawals_expiry on public.buffer_withdrawals(expires_at);
alter table public.buffer_state enable row level security;
alter table public.buffer_withdrawals enable row level security;

drop policy if exists buffer_state_read on public.buffer_state;
create policy buffer_state_read on public.buffer_state for select to authenticated
using ((select auth.uid()) is not null);
drop policy if exists buffer_state_write on public.buffer_state;
create policy buffer_state_write on public.buffer_state for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);
drop policy if exists buffer_withdrawals_read on public.buffer_withdrawals;
create policy buffer_withdrawals_read on public.buffer_withdrawals for select to authenticated
using (expires_at > now() and (select auth.uid()) is not null);
drop policy if exists buffer_withdrawals_insert on public.buffer_withdrawals;
create policy buffer_withdrawals_insert on public.buffer_withdrawals for insert to authenticated
with check (withdrawn_by = (select auth.uid()));
revoke all on public.buffer_state, public.buffer_withdrawals from anon, authenticated;
grant select on public.buffer_state, public.buffer_withdrawals to authenticated;
grant update (pallets, revision, updated_at) on public.buffer_state to authenticated;
grant insert (address, wave) on public.buffer_withdrawals to authenticated;

create or replace function public.buffer_commit(p_pallets jsonb, p_revision bigint, p_withdraw_address text default null)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
    current_state public.buffer_state%rowtype;
    pallet jsonb;
    w jsonb;
begin
    select * into current_state from public.buffer_state where id = 1 for update;
    if not found then raise exception 'Usuário sem acesso ao buffer.'; end if;
    if current_state.revision <> p_revision then
        raise exception 'BUFFER_CONFLICT: o buffer foi alterado por outra pessoa. Recarregue os dados.';
    end if;
    if jsonb_typeof(p_pallets) is distinct from 'array' then raise exception 'Buffer inválido.'; end if;
    if jsonb_array_length(p_pallets) <> 72 or
       (select count(distinct x->>'address') from jsonb_array_elements(p_pallets) x) <> 72 then
        raise exception 'Buffer inválido.';
    end if;
    for pallet in select * from jsonb_array_elements(p_pallets) loop
        if (pallet->>'address') is null or (pallet->>'address') !~ '^[A-L][1-6]$'
           or jsonb_typeof(pallet->'waves') is distinct from 'array' then raise exception 'Vaga inválida.'; end if;
        if jsonb_array_length(pallet->'waves') > 4 then raise exception 'Capacidade excedida.'; end if;
        if (select count(distinct x->>'id') from jsonb_array_elements(pallet->'waves') x)
           <> jsonb_array_length(pallet->'waves') then raise exception 'Onda duplicada.'; end if;
        for w in select * from jsonb_array_elements(pallet->'waves') loop
            if coalesce(w->>'id', '') !~ '^[A-Z0-9][A-Z0-9._/-]{0,63}$'
               or coalesce(w->>'priority', '') not in ('Normal', 'Urgente')
               or jsonb_typeof(w->'origin'->'picking') is distinct from 'boolean'
               or jsonb_typeof(w->'origin'->'pulmao') is distinct from 'boolean'
               or not ((w->'origin'->>'picking')::boolean or (w->'origin'->>'pulmao')::boolean)
               or jsonb_typeof(w->'time') is distinct from 'string'
               or coalesce(w->>'time', '') !~ '^[0-9/,:[:space:]]{1,40}$' then raise exception 'Onda inválida.'; end if;
        end loop;
    end loop;
    if p_withdraw_address is not null then
        if p_withdraw_address !~ '^[A-L][1-6]$' then raise exception 'Retirada inválida.'; end if;
        if exists (select 1 from jsonb_array_elements(p_pallets) x
            where x->>'address' = p_withdraw_address and jsonb_array_length(x->'waves') <> 0) then
            raise exception 'A vaga retirada deve ficar vazia.';
        end if;
        insert into public.buffer_withdrawals (address, wave)
        select p_withdraw_address, wave from jsonb_array_elements(current_state.pallets) p
        cross join lateral jsonb_array_elements(p->'waves') wave
        where p->>'address' = p_withdraw_address;
    end if;
    update public.buffer_state set pallets = p_pallets, revision = revision + 1, updated_at = now() where id = 1;
    return current_state.revision + 1;
end;
$$;
revoke all on function public.buffer_commit(jsonb, bigint, text) from public, anon;
grant execute on function public.buffer_commit(jsonb, bigint, text) to authenticated;
commit;

-- Limpeza no servidor: executa a cada minuto, inclusive com o site fechado.
create extension if not exists pg_cron;
select cron.schedule('buffer-delete-expired-withdrawals', '* * * * *',
    $$delete from public.buffer_withdrawals where expires_at <= now();$$);

-- Todas as contas cadastradas em Authentication > Users têm acesso após login.

-- Verificação:
select id, revision, jsonb_array_length(pallets) as vagas from public.buffer_state;
select jobname, schedule, active from cron.job where jobname = 'buffer-delete-expired-withdrawals';
