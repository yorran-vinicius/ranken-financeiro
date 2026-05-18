# RANKEN Financeiro

Aplicação web de controle financeiro para a RANKEN — comunidade de esportes de raquete.

Stack: **Next.js 14 (App Router) · React · Tailwind CSS · Recharts · Neon Postgres**

---

## Pré-requisitos

- Node.js **18.17+** (recomendado 20 LTS)
- npm (já vem com o Node)

```bash
# macOS via Homebrew
brew install node

# ou via nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
```

---

## Configuração do ambiente

Copie o arquivo de exemplo e preencha os valores:

```bash
cp .env.local.example .env.local
```

### Variáveis obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do banco Neon (obtenha no painel do Neon/Vercel) |
| `SESSION_SECRET` | **⚠️ OBRIGATÓRIO em produção** — segredo para assinar cookies de sessão |

### Gerando um SESSION_SECRET seguro

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Cole o valor gerado no `.env.local` (desenvolvimento) **e** nas variáveis de ambiente do Vercel (produção).

> **Atenção:** sem `SESSION_SECRET` definido em produção, o app usa um secret público embutido no código-fonte — qualquer pessoa poderia forjar sessões. O app exibe um aviso no console quando isso ocorre.

### No Vercel

1. Abra o projeto → **Settings → Environment Variables**
2. Adicione `DATABASE_URL` e `SESSION_SECRET`
3. Faça redeploy

---

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

---

## Migração do banco

Para criar as tabelas e os usuários iniciais no banco Neon:

```bash
node --env-file=.env.local scripts/migrar.mjs
```

Usuários criados (senha inicial: `ranken2026`):

| Login | Perfil |
|---|---|
| `yorran` | master |
| `thales` | editor |
| `laura` | editor |

---

## Estrutura do projeto

```
ranken-financeiro/
├── app/
│   ├── api/
│   │   ├── auth/login/route.ts           # POST login (com rate limiting)
│   │   ├── lancamentos/route.ts          # GET, POST
│   │   ├── lancamentos/[id]/route.ts     # PATCH, DELETE
│   │   ├── configuracoes/geral/route.ts  # GET, PUT
│   │   └── exportar/route.ts             # GET CSV
│   ├── configuracoes/page.tsx
│   ├── lancamentos/page.tsx
│   ├── page.tsx                          # dashboard
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ClientLayout.tsx      # botão +, nav mobile, toast
│   ├── CardsResumo.tsx       # cards com variação % vs mês anterior
│   ├── FluxoCaixa.tsx        # próximos 30 dias
│   ├── InsightsDashboard.tsx # saúde financeira + linha hoje
│   ├── ListaLancamentos.tsx  # lista com editar/favoritar/deletar
│   ├── ModalLancamento.tsx   # modal criar/editar lançamento
│   ├── PainelMetas.tsx
│   ├── PontoEquilibrio.tsx
│   └── ...
├── lib/
│   ├── auth.ts          # iron-session
│   ├── db.ts            # Neon Postgres
│   ├── exportarPDF.ts
│   └── format.ts
├── scripts/
│   └── migrar.mjs       # cria tabelas e seed inicial
├── .env.local.example   # template de variáveis de ambiente
├── tailwind.config.ts
└── package.json
```

---

## Segurança

- **Senhas** armazenadas com bcrypt (cost 10)
- **Sessão** assinada com iron-session (AES-256-CBC + HMAC-SHA256)
- **Rate limiting** no login: máx. 5 tentativas por IP em 15 min → HTTP 429
- **SESSION_SECRET** obrigatório em produção — aviso no console se ausente
- **Timing attack** mitigado: hash comparado mesmo quando usuário não existe

---

## Funcionalidades

- Dashboard com cards de receita/despesa/saldo com variação % vs mês anterior
- Indicador de saúde financeira (verde/amarelo/vermelho)
- Fluxo de caixa projetado para os próximos 30 dias
- Painel de metas anuais com projeção e data estimada
- Ponto de equilíbrio (receita vs custo fixo mensal)
- Filtro por cidade com breakdown por localidade
- Alertas automáticos por categoria e saldo negativo
- Exportar relatório PDF profissional
- Lançamentos: avulso, recorrente e parcelado
- Favoritos com "usar como modelo"
- Busca + filtros combinados (tipo, categoria, período, usuário)
- Exportar CSV
- Configurações: categorias, usuários, funcionalidades por toggle
