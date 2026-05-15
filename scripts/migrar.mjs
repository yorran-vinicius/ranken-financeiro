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

async function migrar() {
  console.log("🔌  Conectando ao banco Neon...");

  // ── Tabela: usuarios ─────────────────────────────────────────────────────────
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
  // Migrações para tabelas pré-existentes (colunas adicionadas ao longo do tempo)
  const alteracoes = [
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS grupo_id TEXT`,
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS tipo_lancamento TEXT NOT NULL DEFAULT 'avulso'`,
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_num INT`,
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_total INT`,
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS criado_por_id TEXT`,
  ];
  for (const q of alteracoes) {
    await sql(q, []).catch(() => {}); // ignora se coluna já existe
  }
  console.log("✅  Tabela 'lancamentos' OK (+ migrações de colunas)");

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

  // ── Seed: usuários iniciais ───────────────────────────────────────────────────
  const [{ c: cUsers }] = await sql`
    SELECT COUNT(*) as c FROM usuarios WHERE login IN ('yorran','thales','laura')
  `;
  if (Number(cUsers) < 3) {
    console.log("⏳  Criando usuários iniciais (bcrypt pode demorar alguns segundos)...");
    const senhaHash = await hash("ranken2026", 10);
    await Promise.allSettled([
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()},'yorran','Yorran','master',${senhaHash},TRUE,TRUE)
          ON CONFLICT (login) DO NOTHING`,
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()},'thales','Thales','editor',${senhaHash},TRUE,TRUE)
          ON CONFLICT (login) DO NOTHING`,
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()},'laura','Laura','editor',${senhaHash},TRUE,TRUE)
          ON CONFLICT (login) DO NOTHING`,
    ]);
    console.log("✅  Usuários iniciais criados (yorran / thales / laura)");
  } else {
    console.log("✅  Usuários iniciais já existem");
  }

  // ── Seed: categorias padrão ───────────────────────────────────────────────────
  const [{ c: cCats }] = await sql`SELECT COUNT(*) as c FROM categorias`;
  if (Number(cCats) === 0) {
    const inserts = [
      ...CATS_RECEITA.map((nome, i) =>
        sql`INSERT INTO categorias (id,tipo,nome,ativo,ordem)
            VALUES (${randomUUID()},'receita',${nome},TRUE,${i})
            ON CONFLICT (tipo,nome) DO NOTHING`
      ),
      ...CATS_DESPESA.map((nome, i) =>
        sql`INSERT INTO categorias (id,tipo,nome,ativo,ordem)
            VALUES (${randomUUID()},'despesa',${nome},TRUE,${i})
            ON CONFLICT (tipo,nome) DO NOTHING`
      ),
    ];
    await Promise.allSettled(inserts);
    console.log(`✅  ${CATS_RECEITA.length + CATS_DESPESA.length} categorias padrão criadas`);
  } else {
    console.log("✅  Categorias já existem");
  }

  // ── Seed: configurações padrão ────────────────────────────────────────────────
  await Promise.allSettled([
    sql`INSERT INTO configuracoes (chave,valor) VALUES ('nome_app','RANKEN Financeiro') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave,valor) VALUES ('moeda','R$') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave,valor) VALUES ('formato_data','dd/mm/aaaa') ON CONFLICT (chave) DO NOTHING`,
  ]);
  console.log("✅  Configurações padrão OK");

  console.log("\n🎉  Migração concluída com sucesso!");
}

migrar().catch((err) => {
  console.error("❌  Falha na migração:", err.message ?? err);
  process.exit(1);
});
