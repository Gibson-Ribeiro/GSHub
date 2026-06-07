-- Estrutura sugerida para preparar o Supabase.
-- As tabelas principais usam JSONB para preservar o modelo atual do localStorage.
-- Futuramente, quando a operação estabilizar, cada JSONB pode ser normalizado em colunas específicas.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  role text not null check (role in ('admin','bar','cozinha')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_user_id_idx on public.profiles(user_id);

create table if not exists public.ingredientes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.custos_fixos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.receitas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.produtos_cardapio (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pedidos (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.comandas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.mesas (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.configuracoes (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS futuro:
-- alter table public.profiles enable row level security;
-- alter table public.ingredientes enable row level security;
-- alter table public.custos_fixos enable row level security;
-- alter table public.receitas enable row level security;
-- alter table public.produtos_cardapio enable row level security;
-- alter table public.pedidos enable row level security;
-- alter table public.comandas enable row level security;
-- alter table public.mesas enable row level security;
-- alter table public.configuracoes enable row level security;
--
-- Políticas sugeridas depois:
-- 1. produtos_cardapio: leitura pública para o cardápio.
-- 2. pedidos: insert público controlado para cardapio.html; leitura/update apenas usuários logados por role.
-- 3. admin: acesso completo às tabelas internas.
-- 4. bar/cozinha: leitura/update de pedidos filtrados pelo setor via função/policy.
