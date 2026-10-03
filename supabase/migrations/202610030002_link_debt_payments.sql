-- Un pago programado puede representar un abono a una deuda existente.
alter table public.planned_payments
  add column if not exists debt_id uuid references public.debts(id) on delete set null;

create or replace function public.complete_planned_payment(p_id uuid, p_already_recorded boolean default false)
returns void language plpgsql security invoker set search_path = public as $$
declare item public.planned_payments%rowtype; debt_item public.debts%rowtype; movement_id uuid;
begin
  select * into item from public.planned_payments
    where id = p_id and user_id = auth.uid() and paid_at is null for update;
  if not found then raise exception 'Pago no encontrado o ya completado'; end if;
  if item.debt_id is not null then
    select * into debt_item from public.debts
      where id = item.debt_id and user_id = auth.uid() for update;
    if not found then raise exception 'Deuda vinculada no encontrada'; end if;
    if item.amount > debt_item.remaining_amount then raise exception 'El pago supera el saldo de la deuda'; end if;
  end if;
  if not p_already_recorded then
    insert into public.transactions (user_id, date, type, amount, category, description, necessity, scope)
    values (auth.uid(), (now() at time zone 'America/Cancun')::date, 'expense', item.amount,
      item.category, item.title, 'necessary', 'personal') returning id into movement_id;
  end if;
  if item.debt_id is not null then
    update public.debts set remaining_amount = remaining_amount - item.amount where id = debt_item.id;
  end if;
  update public.planned_payments set paid_at = now(), transaction_id = movement_id where id = item.id;
end;
$$;
