# Kanban do Estúdio de Criação com HTML/CSS/JS + Supabase

Este projeto é um MVP simples para transformar o fluxo validado no FigJam em um sistema web colaborativo.

Ele usa:

- `index.html` para a estrutura da interface
- `style.css` para o visual
- `app.js` para login, Kanban, filtros, drag-and-drop, cards e indicadores
- `Supabase` para autenticação, banco de dados, segurança e atualização em tempo real
- `GitHub Pages` para publicação gratuita como site estático

## 1. Criar o projeto no Supabase

1. Acesse o Supabase e crie um novo projeto.
2. Depois que o projeto estiver pronto, abra **SQL Editor**.
3. Crie uma nova query.
4. Cole todo o conteúdo do arquivo `schema.sql`.
5. Antes de executar em produção, troque os e-mails de exemplo pelos e-mails reais da equipe:

```sql
update public.team_members
set nome = 'Seu Nome', email = 'seuemail@seudominio.com', funcao = 'Designer'
where email = 'pessoa1@studio.com';
```

Repita para Pessoa 2, Pessoa 3, Pessoa 4 e Pessoa 5.

Importante: somente e-mails que estiverem na tabela `team_members` com `active = true` conseguem ver e editar o quadro.

## 2. Configurar autenticação

No Supabase, vá em **Authentication > Providers > Email**.

Para começar de forma simples:

1. Deixe o provedor de e-mail habilitado.
2. Cada membro da equipe abre o sistema e clica em **Criar acesso**.
3. Se o Supabase pedir confirmação de e-mail, a pessoa confirma pelo link recebido.
4. Depois, entra com e-mail e senha.

Mesmo que outra pessoa tente criar conta, ela não verá os cards se o e-mail não estiver cadastrado como membro ativo em `team_members`.

## 3. Configurar URL e chave pública

No Supabase, vá em **Project Settings > API**.

Copie:

- Project URL
- anon/public key ou publishable key

Depois abra o arquivo `config.js` e substitua:

```js
export const SUPABASE_URL = "https://SEU-PROJETO.supabase.co";
export const SUPABASE_ANON_KEY = "SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE";
```

Nunca coloque a `service_role key` no front-end.

## 4. Rodar localmente

Como o projeto usa módulos JavaScript, rode com um servidor local simples.

No terminal, dentro da pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois abra:

```text
http://localhost:8000
```

Se estiver no Windows e `python3` não funcionar, tente:

```bash
python -m http.server 8000
```

## 5. Configurar URLs de autenticação no Supabase

No Supabase, vá em **Authentication > URL Configuration**.

Adicione como URLs permitidas:

```text
http://localhost:8000
http://localhost:8000/**
```

Depois que publicar no GitHub Pages, adicione também a URL final, por exemplo:

```text
https://seuusuario.github.io/kanban-estudio/
https://seuusuario.github.io/kanban-estudio/**
```

Isso é importante para confirmação de e-mail e redirecionamentos de login.

## 6. Publicar gratuitamente no GitHub Pages

1. Crie um repositório no GitHub, por exemplo `kanban-estudio`.
2. Envie todos os arquivos desta pasta para o repositório.
3. No GitHub, vá em **Settings > Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Escolha a branch `main` e a pasta `/root`.
6. Salve.
7. O GitHub mostrará a URL publicada.
8. Copie essa URL e adicione em **Supabase > Authentication > URL Configuration**.

## 7. Fluxo de uso recomendado

1. Toda nova demanda vira card.
2. Todo card precisa de cliente, responsável, prazo e próxima ação.
3. Arraste o card entre as colunas conforme ele avança.
4. Use a coluna **Bloqueado / Problemas** quando faltar informação, aprovação ou decisão.
5. Revise os indicadores e prazos críticos no começo ou fim do dia.
6. Use o filtro por responsável para ver sobrecarga individual.

## 8. Personalizar colunas

Os títulos das colunas ficam no arquivo `app.js`, dentro de `COLUMNS`.

Se você apenas mudar o nome visual da coluna, basta editar o `title`.

Se você criar uma nova etapa com um novo `id`, também precisa atualizar o campo `check (etapa in (...))` no arquivo `schema.sql` ou diretamente no Supabase.

## 9. Personalizar tipos de demanda

Os tipos aparecem no arquivo `app.js`, dentro de `DEMAND_TYPES`.

Você pode adicionar, remover ou renomear opções como:

- Identidade visual
- Social media
- Campanha
- Landing page
- Apresentação
- Impressos

## 10. Atenção sobre segurança

Este projeto foi montado para ser simples, mas já usa Row Level Security no Supabase.

O princípio de segurança é:

- O front-end usa apenas a chave pública anon/publishable.
- O banco verifica se o usuário autenticado tem e-mail cadastrado em `team_members`.
- Só membros ativos conseguem ler, criar, atualizar ou excluir cards.

Não remova as políticas de RLS sem entender o impacto.

## 11. Próximas melhorias possíveis

Depois do MVP funcionando, você pode evoluir com:

- Comentários por card
- Histórico de alterações
- Upload de arquivos no Supabase Storage
- Notificações por e-mail ou WhatsApp
- Página de cadastro de clientes
- Permissões por função
- Arquivo mensal de cards concluídos
- Dashboard de produtividade por pessoa
