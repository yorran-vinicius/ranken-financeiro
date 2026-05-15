# RANKEN Financeiro

Aplicação web de controle financeiro (MVP) para a RANKEN.

Stack: **Next.js 14 (App Router) · React · Tailwind CSS · Recharts**
Persistência: arquivo JSON local em `data/lancamentos.json`.

---

## Pré-requisitos

- Node.js **18.17+** (recomendado 20 LTS)
- npm (já vem com o Node)

Se ainda não tem o Node:

```bash
# macOS via Homebrew
brew install node

# ou via nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
```

## Como rodar

Na pasta do projeto:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

Para produção:

```bash
npm run build
npm start
```

---

## Funcionalidades

- **Adicionar lançamento** (descrição, valor, tipo, categoria, data)
- **Listar lançamentos** com filtros por **tipo** (receita/despesa/todos) e por **mês**
- **Deletar** lançamento
- **Dashboard** com total de receitas, total de despesas e saldo do mês
- **Gráfico de pizza** por categoria (receitas e despesas separadamente)
- **Gráfico de barras** com a evolução dos últimos 6 meses (receitas × despesas)
- **Exportar CSV** dos lançamentos do mês selecionado (compatível com Excel/Sheets)

## Categorias fixas

- **Receitas:** Mensalidades, Patrocínios, Loja, Confraternização, Outros
- **Despesas:** Time, Marketing, Tecnologia, Operacional, Confraternização, Outros

## Identidade visual

- Preto e branco como base
- Verde RANKEN para receitas: `#3B6D11`
- Vermelho para despesas: `#A32D2D`
- Fonte: **Inter**
- Layout 100% responsivo (mobile + desktop)

## Estrutura

```
ranken-financeiro/
├── app/
│   ├── api/
│   │   ├── lancamentos/route.ts        # GET, POST
│   │   ├── lancamentos/[id]/route.ts   # DELETE
│   │   └── exportar/route.ts           # GET (CSV)
│   ├── lancamentos/page.tsx            # tela de lançamentos
│   ├── page.tsx                        # dashboard
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── CardsResumo.tsx
│   ├── FiltroMes.tsx
│   ├── GraficoBarras.tsx
│   ├── GraficoPizza.tsx
│   ├── ListaLancamentos.tsx
│   ├── NavBar.tsx
│   └── NovoLancamento.tsx
├── lib/
│   ├── categorias.ts
│   ├── db.ts                # leitura/escrita do JSON
│   └── format.ts            # formatadores BRL, datas, meses
├── data/
│   └── lancamentos.json     # banco local (versionar vazio)
├── tailwind.config.ts
└── package.json
```

## Endpoints

| Método | Rota                          | Descrição                                    |
| ------ | ----------------------------- | -------------------------------------------- |
| GET    | `/api/lancamentos?mes=YYYY-MM&tipo=receita\|despesa\|todos` | lista filtrada |
| POST   | `/api/lancamentos`            | cria lançamento                              |
| DELETE | `/api/lancamentos/:id`        | remove lançamento                            |
| GET    | `/api/exportar?mes=YYYY-MM`   | exporta CSV (separador `;`, BOM UTF-8)       |

## Roadmap (próximos MVPs)

- Autenticação por usuário
- Migrar de JSON para SQLite (better-sqlite3) ou Postgres
- Edição inline de lançamentos
- Anexar comprovantes
- Importar extrato bancário
