-- Kanban para estúdio de criação/design
-- Execute este arquivo no Supabase em SQL Editor > New query.
-- Antes de usar em produção, troque os e-mails de exemplo pelos e-mails reais da equipe.

create extension if not exists "pgcrypto";

-- 1) Membros da equipe autorizados a acessar o quadro.
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null unique,
  cor text not null default '#64748b',
  funcao text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) Cards/demandas do Kanban.
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  titulo text not null,
  tipo_demanda text,
  responsavel_id uuid references public.team_members(id) on delete set null,
  revisor_id uuid references public.team_members(id) on delete set null,
  prioridade text not null default 'media' check (prioridade in ('urgente', 'alta', 'media', 'baixa')),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'revisao_interna', 'aguardando_cliente', 'bloqueado', 'aprovado', 'entregue')),
  etapa text not null default 'entrada' check (etapa in ('entrada', 'triagem', 'briefing', 'planejamento', 'criacao', 'revisao', 'enviado_cliente', 'ajustes', 'aprovado', 'entregue', 'bloqueado')),
  prazo date,
  data_entrada date not null default current_date,
  proxima_acao text,
  canal_solicitacao text,
  link_briefing text,
  link_arquivos text,
  link_figma_drive text,
  observacoes text,
  checklist jsonb not null default '[]'::jsonb,
  bloqueado boolean not null default false,
  motivo_bloqueio text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists idx_tasks_etapa on public.tasks(etapa);
create index if not exists idx_tasks_prazo on public.tasks(prazo);
create index if not exists idx_tasks_responsavel on public.tasks(responsavel_id);
create index if not exists idx_tasks_prioridade on public.tasks(prioridade);
create index if not exists idx_team_members_email on public.team_members(lower(email));

-- 3) Atualiza updated_at automaticamente quando um card muda.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

-- 4) Função usada pelas políticas de segurança.
-- Somente e-mails cadastrados como membros ativos podem ler/editar os cards.
create or replace function public.is_active_team_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and tm.active = true
  );
$$;

-- 5) Segurança por linha (RLS).
alter table public.team_members enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "Membros ativos podem ler equipe" on public.team_members;
create policy "Membros ativos podem ler equipe"
on public.team_members
for select
to authenticated
using (public.is_active_team_member());

drop policy if exists "Membros ativos podem ler cards" on public.tasks;
create policy "Membros ativos podem ler cards"
on public.tasks
for select
to authenticated
using (public.is_active_team_member());

drop policy if exists "Membros ativos podem criar cards" on public.tasks;
create policy "Membros ativos podem criar cards"
on public.tasks
for insert
to authenticated
with check (public.is_active_team_member());

drop policy if exists "Membros ativos podem atualizar cards" on public.tasks;
create policy "Membros ativos podem atualizar cards"
on public.tasks
for update
to authenticated
using (public.is_active_team_member())
with check (public.is_active_team_member());

drop policy if exists "Membros ativos podem excluir cards" on public.tasks;
create policy "Membros ativos podem excluir cards"
on public.tasks
for delete
to authenticated
using (public.is_active_team_member());

-- 6) Libera a tabela tasks para atualização em tempo real.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.tasks';
  end if;
end $$;

-- 7) Dados iniciais de exemplo.
-- TROQUE estes e-mails pelos e-mails reais da equipe antes de pedir para as pessoas acessarem.
insert into public.team_members (nome, email, cor, funcao, active)
values
  ('Vagner Monteiro', 'vagulart1@oscarasdoadesivo.com', '#2563eb', 'Designer Senior', true),
  ('Jefferson Ferreira', 'jefferson@oscarasdoadesivo.com.br', '#16a34a', 'Designer', true),
  ('Faviana Monteiro', 'pessoa3@studio.com', '#7c3aed', 'Diretora Geral', true),
  ('Daiane Monteiro', 'pessoa4@studio.com', '#f97316', 'Coordenadora de Produção', true),
  ('Luana Ferreira', 'pessoa5@studio.com', '#db2777', 'Atendimento/Revisão', true)
on conflict (email) do update set
  nome = excluded.nome,
  cor = excluded.cor,
  funcao = excluded.funcao,
  active = excluded.active;

insert into public.tasks (
  cliente, titulo, tipo_demanda, responsavel_id, prioridade, status, etapa,
  prazo, data_entrada, proxima_acao, canal_solicitacao, observacoes, checklist,
  bloqueado, motivo_bloqueio, updated_by
)
values
  (
    'Cliente A', 'Carrossel institucional', 'Carrossel',
    (select id from public.team_members where email = 'pessoa1@studio.com'),
    'alta', 'em_andamento', 'criacao', current_date + 4, current_date,
    'Finalizar primeira versão', 'WhatsApp', 'Peça para rede social institucional.',
    '[{"text":"Briefing recebido","done":true},{"text":"Textos recebidos","done":true},{"text":"Primeira versão criada","done":false}]'::jsonb,
    false, null, 'seed'
  ),
  (
    'Cliente B', 'Ajustes na identidade visual', 'Identidade visual',
    (select id from public.team_members where email = 'pessoa2@studio.com'),
    'media', 'revisao_interna', 'revisao', current_date + 7, current_date,
    'Conferir aplicação da marca', 'E-mail', 'Revisar aplicações antes de enviar.',
    '[{"text":"Briefing recebido","done":true},{"text":"Revisão interna feita","done":false}]'::jsonb,
    false, null, 'seed'
  ),
  (
    'Cliente C', 'Landing page promocional', 'Landing page',
    (select id from public.team_members where email = 'pessoa3@studio.com'),
    'urgente', 'bloqueado', 'bloqueado', current_date + 1, current_date,
    'Aguardar textos do cliente', 'Reunião', 'Projeto depende dos textos finais.',
    '[{"text":"Briefing recebido","done":true},{"text":"Textos recebidos","done":false}]'::jsonb,
    true, 'Cliente ainda não enviou os textos da landing page.', 'seed'
  ),
  (
    'Cliente D', 'Campanha de lançamento', 'Campanha',
    (select id from public.team_members where email = 'pessoa4@studio.com'),
    'alta', 'em_andamento', 'planejamento', current_date + 3, current_date,
    'Definir peças da campanha', 'Reunião', 'Mapear formatos antes de abrir artes.',
    '[{"text":"Briefing recebido","done":true},{"text":"Prazo definido","done":true},{"text":"Responsável definido","done":true}]'::jsonb,
    false, null, 'seed'
  ),
  (
    'Cliente E', 'Apresentação comercial', 'Apresentação',
    (select id from public.team_members where email = 'pessoa5@studio.com'),
    'media', 'aguardando_cliente', 'enviado_cliente', current_date + 5, current_date,
    'Cobrar retorno do cliente', 'E-mail', 'Enviado para validação do cliente.',
    '[{"text":"Primeira versão criada","done":true},{"text":"Enviado ao cliente","done":true},{"text":"Aprovado","done":false}]'::jsonb,
    false, null, 'seed'
  ),
  (
    'Cliente F', 'Peças finais para impressão', 'Impressos',
    (select id from public.team_members where email = 'pessoa1@studio.com'),
    'alta', 'aprovado', 'aprovado', current_date, current_date,
    'Exportar arquivos finais em PDF', 'WhatsApp', 'Conferir sangria e marcas de corte.',
    '[{"text":"Aprovado","done":true},{"text":"Arquivos finais entregues","done":false}]'::jsonb,
    false, null, 'seed'
  )
on conflict do nothing;
