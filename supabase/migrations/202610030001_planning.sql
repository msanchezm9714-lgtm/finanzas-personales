-- Planificación privada: pagos pendientes, deudas y dinero con destino.
create table if not exists public.planned_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  amount numeric(14, 2) not null check (amount > 0),
  due_date date not null,
  category text not null default 'Servicios',
  paid_at timestamptz,
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists planned_payments_user_due_idx on public.planned_payments (user_id, due_date);
alter table public.planned_payments enable row level security;
revoke all on public.planned_payments from anon, authenticated;
grant select, insert, update, delete on public.planned_payments to authenticated;
create policy "Own planned payments" on public.planned_payments for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  original_amount numeric(14, 2) not null check (original_amount > 0),
  remaining_amount numeric(14, 2) not null check (remaining_amount >= 0),
  due_date date,
  created_at timestamptz not null default now(),
  constraint debt_remaining_limit check (remaining_amount <= original_amount)
);
create index if not exists debts_user_idx on public.debts (user_id, created_at desc);
alter table public.debts enable row level security;
revoke all on public.debts from anon, authenticated;
grant select, insert, update, delete on public.debts to authenticated;
create policy "Own debts" on public.debts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table if not exists public.money_pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('envelope', 'goal')),
  title text not null check (char_length(title) between 2 and 100),
  allocated numeric(14, 2) not null default 0 check (allocated >= 0),
  target_amount numeric(14, 2) check (target_amount > 0),
  created_at timestamptz not null default now(),
  constraint goal_has_target check (kind <> 'goal' or target_amount is not null)
);
create index if not exists money_pots_user_kind_idx on public.money_pots (user_id, kind, created_at desc);
alter table public.money_pots enable row level security;
revoke all on public.money_pots from anon, authenticated;
grant select, insert, update, delete on public.money_pots to authenticated;
create policy "Own money pots" on public.money_pots for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Una sola operación registra el gasto y cambia el estado. Evita pagos duplicados por doble clic.
create or replace function public.complete_planned_payment(p_id uuid, p_already_recorded boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare item public.planned_payments%rowtype; movement_id uuid;
begin
  select * into item from public.planned_payments
    where id = p_id and user_id = auth.uid() and paid_at is null for update;
  if not found then raise exception 'Pago no encontrado o ya completado'; end if;
  if not p_already_recorded then
    insert into public.transactions (user_id, date, type, amount, category, description, necessity, scope)
    values (auth.uid(), (now() at time zone 'America/Cancun')::date, 'expense', item.amount,
      item.category, item.title, 'necessary', 'personal') returning id into movement_id;
  end if;
  update public.planned_payments set paid_at = now(), transaction_id = movement_id where id = item.id;
end;
$$;
revoke all on function public.complete_planned_payment(uuid, boolean) from public, anon;
grant execute on function public.complete_planned_payment(uuid, boolean) to authenticated;

create or replace function public.record_debt_payment(p_id uuid, p_amount numeric, p_already_recorded boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare item public.debts%rowtype;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Monto inválido'; end if;
  select * into item from public.debts where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Deuda no encontrada'; end if;
  if p_amount > item.remaining_amount then raise exception 'El pago supera el saldo de la deuda'; end if;
  if not p_already_recorded then
    insert into public.transactions (user_id, date, type, amount, category, description, necessity, scope)
      values (auth.uid(), (now() at time zone 'America/Cancun')::date, 'expense', p_amount,
        'Deudas', 'Abono a ' || item.title, 'necessary', 'personal');
  end if;
  update public.debts set remaining_amount = remaining_amount - p_amount where id = item.id;
end;
$$;
revoke all on function public.record_debt_payment(uuid, numeric, boolean) from public, anon;
grant execute on function public.record_debt_payment(uuid, numeric, boolean) to authenticated;

-- Los apartados son virtuales: moverlos no crea ingresos ni gastos.
create or replace function public.adjust_money_pot(p_id uuid, p_delta numeric)
returns void language plpgsql security invoker set search_path = public as $$
declare item public.money_pots%rowtype;
begin
  if p_delta is null or p_delta = 0 then raise exception 'Monto inválido'; end if;
  select * into item from public.money_pots where id = p_id and user_id = auth.uid() for update;
  if not found then raise exception 'Apartado o meta no encontrado'; end if;
  if item.allocated + p_delta < 0 then raise exception 'No se puede retirar más de lo apartado'; end if;
  update public.money_pots set allocated = allocated + p_delta where id = item.id;
end;
$$;
revoke all on function public.adjust_money_pot(uuid, numeric) from public, anon;
grant execute on function public.adjust_money_pot(uuid, numeric) to authenticated;
