-- Plan para salir de deudas: tasa y pago mínimo por deuda, y programar el mes de un plan en una sola operación.
alter table public.debts
  add column if not exists annual_rate numeric(6, 2) check (annual_rate >= 0 and annual_rate <= 500),
  add column if not exists min_payment numeric(14, 2) check (min_payment > 0);

-- p_items: [{"debt_id": "<uuid>", "amount": 1234.5}, ...]. Todo o nada: si un abono no cabe, no se guarda ninguno.
create or replace function public.schedule_debt_plan(p_items jsonb, p_due_date date)
returns integer language plpgsql security invoker set search_path = public as $$
declare item jsonb; scheduled integer := 0;
begin
  if p_due_date is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Plan inválido'; end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then raise exception 'Plan vacío o demasiado grande'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    perform public.schedule_debt_payment((item->>'debt_id')::uuid, (item->>'amount')::numeric, p_due_date, null);
    scheduled := scheduled + 1;
  end loop;
  return scheduled;
end;
$$;
revoke all on function public.schedule_debt_plan(jsonb, date) from public, anon;
grant execute on function public.schedule_debt_plan(jsonb, date) to authenticated;
