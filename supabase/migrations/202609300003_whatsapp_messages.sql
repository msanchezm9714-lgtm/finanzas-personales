-- Identificador de Meta para evitar movimientos duplicados si reintenta un aviso.
alter table public.transactions
  add column if not exists whatsapp_message_id text;

create unique index if not exists transactions_whatsapp_message_id_idx
  on public.transactions (whatsapp_message_id);
