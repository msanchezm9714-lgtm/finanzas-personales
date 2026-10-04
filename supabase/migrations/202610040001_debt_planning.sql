-- Etiquetas para deudas y abonos futuros vinculados, sin modificar los registros existentes.
alter table public.debts
  add column if not exists category text not null default 'Otros'
  check (char_length(category) between 2 and 40);

create or replace function public.schedule_debt_payment(
  p_debt_id uuid,
  p_amount numeric,
  p_due_date date,
  p_title text default null
)
returns void language plpgsql security invoker set search_path = public as $$
declare debt_item public.debts%rowtype; planned_total numeric;
begin
  if p_amount is null or p_amount <= 0 or p_due_date is null then
    raise exception 'Monto o fecha inválidos';
  end if;
  select * into debt_item from public.debts
    where id = p_debt_id and user_id = auth.uid() for update;
  if not found then raise exception 'Deuda no encontrada'; end if;
  select coalesce(sum(amount), 0) into planned_total from public.planned_payments
    where debt_id = p_debt_id and user_id = auth.uid() and paid_at is null;
  if p_amount + planned_total > debt_item.remaining_amount then
    raise exception 'Los abonos futuros superan el saldo pendiente';
  end if;
  insert into public.planned_payments (user_id, title, amount, due_date, category, debt_id)
    values (auth.uid(), coalesce(nullif(btrim(p_title), ''), 'Abono a ' || debt_item.title),
      p_amount, p_due_date, 'Deudas', p_debt_id);
end;
$$;
revoke all on function public.schedule_debt_payment(uuid, numeric, date, text) from public, anon;
grant execute on function public.schedule_debt_payment(uuid, numeric, date, text) to authenticated;

create or replace function public.link_planned_payment_to_debt(p_payment_id uuid, p_debt_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare payment_item public.planned_payments%rowtype; debt_item public.debts%rowtype; planned_total numeric;
begin
  select * into payment_item from public.planned_payments
    where id = p_payment_id and user_id = auth.uid() and paid_at is null and debt_id is null for update;
  if not found then raise exception 'Pago no encontrado o ya vinculado'; end if;
  select * into debt_item from public.debts
    where id = p_debt_id and user_id = auth.uid() for update;
  if not found then raise exception 'Deuda no encontrada'; end if;
  select coalesce(sum(amount), 0) into planned_total from public.planned_payments
    where debt_id = p_debt_id and user_id = auth.uid() and paid_at is null;
  if payment_item.amount + planned_total > debt_item.remaining_amount then
    raise exception 'Los abonos futuros superan el saldo pendiente';
  end if;
  update public.planned_payments set debt_id = p_debt_id, category = 'Deudas'
    where id = payment_item.id;
end;
$$;
revoke all on function public.link_planned_payment_to_debt(uuid, uuid) from public, anon;
grant execute on function public.link_planned_payment_to_debt(uuid, uuid) to authenticated;
