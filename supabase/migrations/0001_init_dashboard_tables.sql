-- 0001_init_dashboard_tables.sql
-- Amazing Business Hub — esquema base para el dashboard de admin.
--
-- SEGURIDAD: este script es IDEMPOTENTE. Usa `create table if not exists`,
-- por lo que se puede correr varias veces sin borrar ni pisar datos:
--   - Si las tablas NO existen  -> las crea.
--   - Si las tablas YA existen  -> no hace nada (no toca columnas ni filas).
--
-- No incluye ningún DROP. Nunca borra nada.

-- Necesario para gen_random_uuid() (incluido por defecto en Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- clients
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  plan           text,                       -- 'Platinum' | 'Gold' | 'Silver' | ...
  monthly_amount numeric(10,2) default 0,
  status         text default 'active',      -- 'active' | 'lead' | 'inactive' | ...
  created_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete set null,
  amount      numeric(10,2) default 0,
  method      text,                           -- 'Visa ••42' | 'Invoice' | ...
  status      text default 'paid',            -- 'paid' | 'pending' | ...
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table if not exists public.invoices (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete set null,
  amount      numeric(10,2) default 0,
  status      text default 'pending',         -- 'pending' | 'paid' | 'overdue' | ...
  due_date    date,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions  (alimenta "Upcoming Renewals")
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references public.clients(id) on delete set null,
  plan          text,
  renewal_date  date,
  status        text default 'active',
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- tasks  (alimenta el badge de "Tickets")
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  status      text default 'open',            -- 'open' | 'closed' | ...
  client_id   uuid references public.clients(id) on delete set null,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- email_templates  (alimenta "Email Center")
-- ---------------------------------------------------------------------------
create table if not exists public.email_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  subject     text,
  body        text,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Se habilita RLS para que las tablas no queden abiertas. Las queries del
-- dashboard corren del lado del servidor con la anon key + sesión del usuario,
-- así que conviene una policy de lectura para usuarios autenticados.
-- (Idempotente: DROP POLICY IF EXISTS antes de crear, no toca datos.)

alter table public.clients         enable row level security;
alter table public.payments        enable row level security;
alter table public.invoices        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.tasks           enable row level security;
alter table public.email_templates enable row level security;

drop policy if exists "auth read clients"         on public.clients;
drop policy if exists "auth read payments"        on public.payments;
drop policy if exists "auth read invoices"        on public.invoices;
drop policy if exists "auth read subscriptions"   on public.subscriptions;
drop policy if exists "auth read tasks"           on public.tasks;
drop policy if exists "auth read email_templates" on public.email_templates;

create policy "auth read clients"         on public.clients         for select to authenticated using (true);
create policy "auth read payments"        on public.payments        for select to authenticated using (true);
create policy "auth read invoices"        on public.invoices        for select to authenticated using (true);
create policy "auth read subscriptions"   on public.subscriptions   for select to authenticated using (true);
create policy "auth read tasks"           on public.tasks           for select to authenticated using (true);
create policy "auth read email_templates" on public.email_templates for select to authenticated using (true);
