-- Saldo anterior al primer movimiento registrado por cada usuario.
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  opening_balance numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on public.user_settings from anon, authenticated;
grant select, insert, update on public.user_settings to authenticated;

drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings"
  on public.user_settings for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own settings" on public.user_settings;
create policy "Users can create their own settings"
  on public.user_settings for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own settings" on public.user_settings;
create policy "Users can update their own settings"
  on public.user_settings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
