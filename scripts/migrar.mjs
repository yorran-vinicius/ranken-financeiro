#!/usr/bin/env node
/**
 * Script de migração do banco de dados RANKEN Financeiro.
 * Uso: node --env-file=.env.local scripts/migrar.mjs
 */

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import { hash } from "bcryptjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌  DATABASE_URL não definida. Crie o arquivo .env.local com a variável.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

const CATS_RECEITA = ["Mensalidades", "Patrocínios", "Loja", "Confraternização", "Outros"];
const CATS_DESPESA = ["Time", "Marketing", "Tecnologia", "Operacional", "Confraternização", "Outros"];

const USUARIOS = [
  { login: "yorran", nome: "Yorran", perfil: "master"  },
  { login: "thales", nome: "Thales", perfil: "editor"  },
  { login: "laura",  nome: "Laura",  perfil: "editor"  },
];

async function migrar() {
  console.log("🔌  Conectando ao banco Neon...");

  // ── Tabela: usuarios ──────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id                   TEXT        PRIMARY KEY,
      login                TEXT        NOT NULL UNIQUE,
      nome                 TEXT        NOT NULL,
      perfil               TEXT        NOT NULL DEFAULT 'editor',
      senha_hash           TEXT        NOT NULL,
      ativo                BOOLEAN     NOT NULL DEFAULT TRUE,
      deve_atualizar_senha BOOLEAN     NOT NULL DEFAULT FALSE,
      criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅  Tabela 'usuarios' OK");

  // ── Tabela: grupos_lancamento ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS grupos_lancamento (
      id               TEXT          PRIMARY KEY,
      tipo             TEXT          NOT NULL,
      descricao        TEXT          NOT NULL,
      valor_base       NUMERIC(12,2) NOT NULL,
      tipo_financeiro  TEXT          NOT NULL,
      categoria        TEXT          NOT NULL,
      frequencia       TEXT,
      data_inicio      TEXT,
      data_fim         TEXT,
      total_parcelas   INT,
      valor_total      NUMERIC(12,2),
      criado_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅  Tabela 'grupos_lancamento' OK");

  // ── Tabela: lancamentos ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id               TEXT          PRIMARY KEY,
      grupo_id         TEXT,
      descricao        TEXT          NOT NULL,
      valor            NUMERIC(12,2) NOT NULL,
      tipo             TEXT          NOT NULL,
      categoria        TEXT          NOT NULL,
      data             TEXT          NOT NULL,
      tipo_lancamento  TEXT          NOT NULL DEFAULT 'avulso',
      parcela_num      INT,
      parcela_total    INT,
      cancelado        BOOLEAN       NOT NULL DEFAULT FALSE,
      criado_por_id    TEXT,
      criado_em        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
  // Colunas adicionadas ao longo do tempo (sem erro se já existirem)
  const alteracoes = [
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS grupo_id TEXT",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS tipo_lancamento TEXT NOT NULL DEFAULT 'avulso'",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_num INT",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_total INT",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS criado_por_id TEXT",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cidade TEXT",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS notas TEXT",
  ];
  for (const q of alteracoes) {
    try { await sql.unsafe(q); } catch { /* coluna já existe */ }
  }

  // Índices para queries frequentes
  const indices = [
    "CREATE INDEX IF NOT EXISTS idx_lancamentos_data       ON lancamentos(data)",
    "CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo       ON lancamentos(tipo)",
    "CREATE INDEX IF NOT EXISTS idx_lancamentos_cancelado  ON lancamentos(cancelado)",
    "CREATE INDEX IF NOT EXISTS idx_lancamentos_criado_por ON lancamentos(criado_por_id)",
  ];
  for (const q of indices) {
    try { await sql.unsafe(q); } catch { /* índice já existe */ }
  }
  console.log("✅  Tabela 'lancamentos' OK (+ índices)");

  // ── Tabela: categorias ────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS categorias (
      id        TEXT        PRIMARY KEY,
      tipo      TEXT        NOT NULL,
      nome      TEXT        NOT NULL,
      ativo     BOOLEAN     NOT NULL DEFAULT TRUE,
      ordem     INT         NOT NULL DEFAULT 0,
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(tipo, nome)
    )
  `;
  console.log("✅  Tabela 'categorias' OK");

  // ── Tabela: configuracoes ─────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `;
  console.log("✅  Tabela 'configuracoes' OK");

  // ── Usuários iniciais ─────────────────────────────────────────────────────────
  console.log("⏳  Gerando hash de senha (bcrypt)...");
  const senhaHash = await hash("ranken2026", 10);

  for (const u of USUARIOS) {
    await sql`
      INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
      VALUES (${randomUUID()}, ${u.login}, ${u.nome}, ${u.perfil}, ${senhaHash}, TRUE, TRUE)
      ON CONFLICT (login) DO UPDATE SET
        nome   = EXCLUDED.nome,
        perfil = EXCLUDED.perfil
    `;
    console.log(`✅  Usuário '${u.login}' (${u.perfil}) OK`);
  }

  // ── Categorias padrão ─────────────────────────────────────────────────────────
  for (const [i, nome] of CATS_RECEITA.entries()) {
    await sql`
      INSERT INTO categorias (id, tipo, nome, ativo, ordem)
      VALUES (${randomUUID()}, 'receita', ${nome}, TRUE, ${i})
      ON CONFLICT (tipo, nome) DO NOTHING
    `;
  }
  for (const [i, nome] of CATS_DESPESA.entries()) {
    await sql`
      INSERT INTO categorias (id, tipo, nome, ativo, ordem)
      VALUES (${randomUUID()}, 'despesa', ${nome}, TRUE, ${i})
      ON CONFLICT (tipo, nome) DO NOTHING
    `;
  }
  console.log(`✅  ${CATS_RECEITA.length + CATS_DESPESA.length} categorias padrão OK`);

  // ── Configurações padrão ──────────────────────────────────────────────────────
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('nome_app', 'RANKEN Financeiro') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('moeda', 'R$') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('formato_data', 'dd/mm/aaaa') ON CONFLICT (chave) DO NOTHING`;
  // Configurações básicas
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('nome_app', 'RANKEN Financeiro') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('moeda', 'R$') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('formato_data', 'dd/mm/aaaa') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('alertas_limites', '{}') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('meta_anual', '300000') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('custo_fixo_mensal', '20000') ON CONFLICT (chave) DO NOTHING`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('cidades', 'Maringá,Londrina,Curitiba,Geral') ON CONFLICT (chave) DO NOTHING`;
  // Funcionalidades: ativa todas por padrão
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_metas', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_equilibrio', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_cidade', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_pdf', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'`;
  await sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_alertas', 'true') ON CONFLICT (chave) DO UPDATE SET valor = 'true'`;
  console.log("✅  Configurações padrão OK");

  // ── Verificação final ─────────────────────────────────────────────────────────
  const rows = await sql`SELECT login, nome, perfil, ativo FROM usuarios ORDER BY criado_em ASC`;
  console.log("\n📋  Usuários no banco:");
  for (const u of rows) {
    console.log(`   • ${u.login} | ${u.nome} | ${u.perfil} | ativo=${u.ativo}`);
  }

  console.log("\n🎉  Migração concluída com sucesso!");
}

migrar().catch((err) => {
  console.error("❌  Falha na migração:", err.message ?? err);
  process.exit(1);
});
