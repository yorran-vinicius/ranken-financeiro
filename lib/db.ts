import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import type { TipoLancamento } from "./categorias";
import {
  gerarDatasRecorrente,
  gerarDatasParcelas,
  type Frequencia,
} from "./recorrencia";

export type { Frequencia };
export type TipoLancamentoExtendido = "avulso" | "recorrente" | "parcelado";

export interface GrupoLancamento {
  id: string;
  tipo: "recorrente" | "parcelado";
  descricao: string;
  valorBase: number;
  tipoFinanceiro: TipoLancamento;
  categoria: string;
  frequencia?: Frequencia;
  dataInicio?: string;
  dataFim?: string | null;
  totalParcelas?: number;
  valorTotal?: number;
  criadoEm: string;
}

export interface Lancamento {
  id: string;
  grupoId: string | null;
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  categoria: string;
  data: string;
  cidade: string | null;
  notas: string | null;
  favorito: boolean;
  tipoLancamento: TipoLancamentoExtendido;
  parcelaNum: number | null;
  parcelaTotal: number | null;
  cancelado: boolean;
  criadoEm: string;
  criadoPorId: string | null;
  criadoPorNome: string | null;
}

export interface Usuario {
  id: string;
  login: string;
  nome: string;
  perfil: "master" | "editor";
  ativo: boolean;
  deveAtualizarSenha: boolean;
  criadoEm: string;
}

export interface UsuarioComSenha extends Usuario {
  senhaHash: string;
}

export interface CategoriaDB {
  id: string;
  tipo: "receita" | "despesa";
  nome: string;
  ativo: boolean;
  ordem: number;
}

export type Configuracoes = Record<string, string>;

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurado");
  return neon(url);
}

function tsISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return new Date(v as string).toISOString();
}

function toRow(row: Record<string, unknown>): Lancamento {
  return {
    id:              row.id as string,
    grupoId:         (row.grupo_id as string) ?? null,
    descricao:       row.descricao as string,
    valor:           Number(row.valor),
    tipo:            row.tipo as TipoLancamento,
    categoria:       row.categoria as string,
    data:            row.data as string,
    cidade:          (row.cidade as string) ?? null,
    notas:           (row.notas as string) ?? null,
    favorito:        Boolean(row.favorito),
    tipoLancamento:  ((row.tipo_lancamento as string) ?? "avulso") as TipoLancamentoExtendido,
    parcelaNum:      row.parcela_num != null ? Number(row.parcela_num) : null,
    parcelaTotal:    row.parcela_total != null ? Number(row.parcela_total) : null,
    cancelado:       Boolean(row.cancelado),
    criadoEm:        tsISO(row.criado_em),
    criadoPorId:     (row.criado_por_id as string) ?? null,
    criadoPorNome:   (row.criado_por_nome as string) ?? null,
  };
}

function toGrupo(row: Record<string, unknown>): GrupoLancamento {
  return {
    id:             row.id as string,
    tipo:           row.tipo as "recorrente" | "parcelado",
    descricao:      row.descricao as string,
    valorBase:      Number(row.valor_base),
    tipoFinanceiro: row.tipo_financeiro as TipoLancamento,
    categoria:      row.categoria as string,
    frequencia:     (row.frequencia as Frequencia) ?? undefined,
    dataInicio:     (row.data_inicio as string) ?? undefined,
    dataFim:        (row.data_fim as string) ?? null,
    totalParcelas:  row.total_parcelas != null ? Number(row.total_parcelas) : undefined,
    valorTotal:     row.valor_total != null ? Number(row.valor_total) : undefined,
    criadoEm:       tsISO(row.criado_em),
  };
}

function toCat(row: Record<string, unknown>): CategoriaDB {
  return {
    id:     row.id as string,
    tipo:   row.tipo as "receita" | "despesa",
    nome:   row.nome as string,
    ativo:  Boolean(row.ativo),
    ordem:  Number(row.ordem),
  };
}

function toUsuario(row: Record<string, unknown>): Usuario {
  return {
    id:                   row.id as string,
    login:                row.login as string,
    nome:                 row.nome as string,
    perfil:               row.perfil as "master" | "editor",
    ativo:                Boolean(row.ativo),
    deveAtualizarSenha:   Boolean(row.deve_atualizar_senha),
    criadoEm:             tsISO(row.criado_em),
  };
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const CATS_RECEITA = ["Mensalidades", "Patrocínios", "Loja", "Confraternização", "Outros"];
const CATS_DESPESA = ["Time", "Marketing", "Tecnologia", "Operacional", "Confraternização", "Outros"];

export async function garantirTabelas() {
  const sql = db();

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

  await sql`
    CREATE TABLE IF NOT EXISTS configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    )
  `;

  // Migrações para tabelas pré-existentes
  await Promise.allSettled([
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS grupo_id TEXT`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS tipo_lancamento TEXT NOT NULL DEFAULT 'avulso'`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_num INT`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS parcela_total INT`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cancelado BOOLEAN NOT NULL DEFAULT FALSE`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS criado_por_id TEXT`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS cidade TEXT`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS favorito BOOLEAN NOT NULL DEFAULT FALSE`,
    sql`ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS notas TEXT`,
  ]);

  // Seed: usuários iniciais
  const existingUsers = await sql`SELECT login FROM usuarios WHERE login IN ('yorran', 'thales', 'laura')`;
  if (existingUsers.length < 3) {
    const { hash } = await import("bcryptjs");
    const senhaHash = await hash("ranken2026", 10);
    await Promise.allSettled([
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()}, 'yorran', 'Yorran', 'master', ${senhaHash}, TRUE, TRUE)
          ON CONFLICT (login) DO NOTHING`,
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()}, 'thales', 'Thales', 'editor', ${senhaHash}, TRUE, TRUE)
          ON CONFLICT (login) DO NOTHING`,
      sql`INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
          VALUES (${randomUUID()}, 'laura', 'Laura', 'editor', ${senhaHash}, TRUE, TRUE)
          ON CONFLICT (login) DO NOTHING`,
    ]);
  }

  // Seed: categorias padrão
  const existingCats = await sql`SELECT id FROM categorias LIMIT 1`;
  if (existingCats.length === 0) {
    const inserts = [
      ...CATS_RECEITA.map((nome, i) =>
        sql`INSERT INTO categorias (id, tipo, nome, ativo, ordem) VALUES (${randomUUID()}, 'receita', ${nome}, TRUE, ${i}) ON CONFLICT (tipo, nome) DO NOTHING`
      ),
      ...CATS_DESPESA.map((nome, i) =>
        sql`INSERT INTO categorias (id, tipo, nome, ativo, ordem) VALUES (${randomUUID()}, 'despesa', ${nome}, TRUE, ${i}) ON CONFLICT (tipo, nome) DO NOTHING`
      ),
    ];
    await Promise.allSettled(inserts);
  }

  // Seed: configurações padrão
  await Promise.allSettled([
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('nome_app', 'RANKEN Financeiro') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('moeda', 'R$') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('formato_data', 'dd/mm/aaaa') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_metas', 'false') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('meta_anual', '300000') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_equilibrio', 'false') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('custo_fixo_mensal', '20000') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_cidade', 'false') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('cidades', 'Maringá,Londrina,Curitiba,Geral') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_pdf', 'false') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('func_alertas', 'false') ON CONFLICT (chave) DO NOTHING`,
    sql`INSERT INTO configuracoes (chave, valor) VALUES ('alertas_limites', '{}') ON CONFLICT (chave) DO NOTHING`,
  ]);
}

// ─── Leitura de lançamentos ───────────────────────────────────────────────────

export async function lerLancamentos(criadoPorId?: string): Promise<Lancamento[]> {
  await garantirTabelas();
  const sql = db();
  const rows = criadoPorId
    ? await sql`
        SELECT l.*, u.nome AS criado_por_nome
        FROM lancamentos l
        LEFT JOIN usuarios u ON l.criado_por_id = u.id
        WHERE l.cancelado = FALSE AND l.criado_por_id = ${criadoPorId}
        ORDER BY l.data DESC, l.criado_em DESC
      `
    : await sql`
        SELECT l.*, u.nome AS criado_por_nome
        FROM lancamentos l
        LEFT JOIN usuarios u ON l.criado_por_id = u.id
        WHERE l.cancelado = FALSE
        ORDER BY l.data DESC, l.criado_em DESC
      `;
  return rows.map(toRow);
}

export async function lerLancamentosGrupo(grupoId: string): Promise<Lancamento[]> {
  const sql = db();
  const rows = await sql`
    SELECT l.*, u.nome AS criado_por_nome
    FROM lancamentos l
    LEFT JOIN usuarios u ON l.criado_por_id = u.id
    WHERE l.grupo_id = ${grupoId}
    ORDER BY l.data ASC
  `;
  return rows.map(toRow);
}

export async function lerGrupo(id: string): Promise<GrupoLancamento | null> {
  const sql = db();
  const rows = await sql`SELECT * FROM grupos_lancamento WHERE id = ${id}`;
  if (rows.length === 0) return null;
  return toGrupo(rows[0]);
}

/** Returns the criado_por_id for a lancamento (for ownership check) */
export async function lerCriadorLancamento(id: string): Promise<string | null> {
  const sql = db();
  const rows = await sql`SELECT criado_por_id FROM lancamentos WHERE id = ${id}`;
  if (rows.length === 0) return undefined as unknown as null;
  return (rows[0].criado_por_id as string) ?? null;
}

/** Returns the criado_por_id of the first lancamento in a group */
export async function lerCriadorGrupo(grupoId: string): Promise<string | null> {
  const sql = db();
  const rows = await sql`
    SELECT criado_por_id FROM lancamentos
    WHERE grupo_id = ${grupoId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return (rows[0].criado_por_id as string) ?? null;
}

// ─── Criação de lançamentos ───────────────────────────────────────────────────

export async function adicionarAvulso(
  input: Omit<Lancamento, "id" | "grupoId" | "cidade" | "notas" | "favorito" | "tipoLancamento" | "parcelaNum" | "parcelaTotal" | "cancelado" | "criadoEm" | "criadoPorId" | "criadoPorNome">,
  criadoPorId?: string | null,
  cidade?: string | null,
): Promise<Lancamento> {
  await garantirTabelas();
  const sql = db();
  const id = randomUUID();
  const uid = criadoPorId ?? null;
  const cid = cidade ?? null;
  const [row] = await sql`
    INSERT INTO lancamentos (id, grupo_id, descricao, valor, tipo, categoria, data, tipo_lancamento, criado_por_id, cidade)
    VALUES (${id}, NULL, ${input.descricao}, ${input.valor}, ${input.tipo}, ${input.categoria}, ${input.data}, 'avulso', ${uid}, ${cid})
    RETURNING *
  `;
  return { ...toRow(row), criadoPorNome: null };
}

export interface InputRecorrente {
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  categoria: string;
  frequencia: Frequencia;
  dataInicio: string;
  dataFim?: string | null;
  cidade?: string | null;
}

export async function adicionarRecorrente(
  input: InputRecorrente,
  criadoPorId?: string | null,
): Promise<GrupoLancamento> {
  await garantirTabelas();
  const sql = db();
  const grupoId = randomUUID();
  const uid = criadoPorId ?? null;
  const cid = input.cidade ?? null;

  await sql`
    INSERT INTO grupos_lancamento
      (id, tipo, descricao, valor_base, tipo_financeiro, categoria, frequencia, data_inicio, data_fim)
    VALUES
      (${grupoId}, 'recorrente', ${input.descricao}, ${input.valor}, ${input.tipo},
       ${input.categoria}, ${input.frequencia}, ${input.dataInicio}, ${input.dataFim ?? null})
  `;

  const datas = gerarDatasRecorrente(input.dataInicio, input.frequencia, input.dataFim);
  for (const data of datas) {
    const id = randomUUID();
    await sql`
      INSERT INTO lancamentos (id, grupo_id, descricao, valor, tipo, categoria, data, tipo_lancamento, criado_por_id, cidade)
      VALUES (${id}, ${grupoId}, ${input.descricao}, ${input.valor}, ${input.tipo},
              ${input.categoria}, ${data}, 'recorrente', ${uid}, ${cid})
    `;
  }

  return (await lerGrupo(grupoId))!;
}

export interface InputParcelado {
  descricao: string;
  valorParcela: number;
  valorTotal: number;
  tipo: TipoLancamento;
  categoria: string;
  totalParcelas: number;
  dataPrimeira: string;
  cidade?: string | null;
}

export async function adicionarParcelado(
  input: InputParcelado,
  criadoPorId?: string | null,
): Promise<GrupoLancamento> {
  await garantirTabelas();
  const sql = db();
  const grupoId = randomUUID();
  const uid = criadoPorId ?? null;
  const cid = input.cidade ?? null;

  await sql`
    INSERT INTO grupos_lancamento
      (id, tipo, descricao, valor_base, tipo_financeiro, categoria, total_parcelas, valor_total, data_inicio)
    VALUES
      (${grupoId}, 'parcelado', ${input.descricao}, ${input.valorParcela}, ${input.tipo},
       ${input.categoria}, ${input.totalParcelas}, ${input.valorTotal}, ${input.dataPrimeira})
  `;

  const datas = gerarDatasParcelas(input.dataPrimeira, input.totalParcelas);
  for (let i = 0; i < datas.length; i++) {
    const id = randomUUID();
    const label = `${input.descricao} (${i + 1}/${input.totalParcelas})`;
    await sql`
      INSERT INTO lancamentos
        (id, grupo_id, descricao, valor, tipo, categoria, data, tipo_lancamento, parcela_num, parcela_total, criado_por_id, cidade)
      VALUES
        (${id}, ${grupoId}, ${label}, ${input.valorParcela}, ${input.tipo},
         ${input.categoria}, ${datas[i]}, 'parcelado', ${i + 1}, ${input.totalParcelas}, ${uid}, ${cid})
    `;
  }

  return (await lerGrupo(grupoId))!;
}

// ─── Remoção ──────────────────────────────────────────────────────────────────

export async function atualizarLancamento(
  id: string,
  dados: {
    descricao: string;
    valor: number;
    tipo: string;
    categoria: string;
    data: string;
    notas: string | null;
    cidade: string | null;
  },
): Promise<Lancamento | null> {
  const sql = db();
  const rows = await sql`
    UPDATE lancamentos SET
      descricao = ${dados.descricao},
      valor     = ${dados.valor},
      tipo      = ${dados.tipo},
      categoria = ${dados.categoria},
      data      = ${dados.data},
      notas     = ${dados.notas},
      cidade    = ${dados.cidade}
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return { ...toRow(rows[0] as Record<string, unknown>), criadoPorNome: null };
}

export async function toggleFavorito(id: string, favorito: boolean): Promise<Lancamento | null> {
  const sql = db();
  const rows = await sql`
    UPDATE lancamentos SET favorito = ${favorito} WHERE id = ${id} RETURNING *
  `;
  if (rows.length === 0) return null;
  return { ...toRow(rows[0] as Record<string, unknown>), criadoPorNome: null };
}

export async function removerLancamento(id: string): Promise<boolean> {
  const sql = db();
  const result = await sql`DELETE FROM lancamentos WHERE id = ${id} RETURNING id`;
  return result.length > 0;
}

// ─── Gestão de grupos ─────────────────────────────────────────────────────────

export async function encerrarGrupo(grupoId: string, dataCorte: string): Promise<void> {
  const sql = db();
  await sql`
    UPDATE lancamentos SET cancelado = TRUE
    WHERE grupo_id = ${grupoId} AND data >= ${dataCorte} AND cancelado = FALSE
  `;
}

export async function cancelarTodosGrupo(grupoId: string): Promise<void> {
  const hoje = new Date().toISOString().slice(0, 10);
  const sql = db();
  await sql`
    UPDATE lancamentos SET cancelado = TRUE
    WHERE grupo_id = ${grupoId} AND data >= ${hoje} AND cancelado = FALSE
  `;
}

export async function reajustarGrupo(
  grupoId: string,
  dataCorte: string,
  novoValor: number
): Promise<void> {
  const sql = db();
  await sql`UPDATE grupos_lancamento SET valor_base = ${novoValor} WHERE id = ${grupoId}`;
  await sql`
    UPDATE lancamentos SET valor = ${novoValor}
    WHERE grupo_id = ${grupoId} AND data >= ${dataCorte} AND cancelado = FALSE
  `;
}

// ─── Filtros em memória ───────────────────────────────────────────────────────

export function filtrarPorMes(lancamentos: Lancamento[], mesAno: string): Lancamento[] {
  return lancamentos.filter((l) => l.data.startsWith(mesAno));
}

export function filtrarPorTipo(
  lancamentos: Lancamento[],
  tipo: TipoLancamento | "todos"
): Lancamento[] {
  if (tipo === "todos") return lancamentos;
  return lancamentos.filter((l) => l.tipo === tipo);
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

export async function buscarUsuarioPorLogin(login: string): Promise<UsuarioComSenha | null> {
  const sql = db();
  const rows = await sql`SELECT * FROM usuarios WHERE login = ${login} AND ativo = TRUE`;
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return { ...toUsuario(r), senhaHash: r.senha_hash as string };
}

export async function listarUsuarios(): Promise<Usuario[]> {
  await garantirTabelas();
  const sql = db();
  const rows = await sql`SELECT * FROM usuarios ORDER BY criado_em ASC`;
  return rows.map((r) => toUsuario(r as Record<string, unknown>));
}

export async function criarUsuario(
  login: string,
  nome: string,
  perfil: "master" | "editor",
  senhaHash: string,
): Promise<Usuario> {
  await garantirTabelas();
  const sql = db();
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO usuarios (id, login, nome, perfil, senha_hash, ativo, deve_atualizar_senha)
    VALUES (${id}, ${login}, ${nome}, ${perfil}, ${senhaHash}, TRUE, TRUE)
    RETURNING *
  `;
  return toUsuario(row as Record<string, unknown>);
}

export async function atualizarUsuario(
  id: string,
  dados: Partial<{ login: string; nome: string; perfil: "master" | "editor"; ativo: boolean; deveAtualizarSenha: boolean; senhaHash: string }>
): Promise<Usuario | null> {
  const sql = db();
  const login              = dados.login              ?? null;
  const nome               = dados.nome               ?? null;
  const perfil             = dados.perfil             ?? null;
  const ativo              = dados.ativo              ?? null;
  const deveAtualizarSenha = dados.deveAtualizarSenha ?? null;
  const senhaHash          = dados.senhaHash          ?? null;

  const rows = await sql`
    UPDATE usuarios SET
      login              = COALESCE(${login}::TEXT,    login),
      nome               = COALESCE(${nome}::TEXT,     nome),
      perfil             = COALESCE(${perfil}::TEXT,   perfil),
      ativo              = COALESCE(${ativo}::BOOLEAN,  ativo),
      deve_atualizar_senha = COALESCE(${deveAtualizarSenha}::BOOLEAN, deve_atualizar_senha),
      senha_hash         = COALESCE(${senhaHash}::TEXT, senha_hash)
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return toUsuario(rows[0] as Record<string, unknown>);
}

// ─── Categorias ───────────────────────────────────────────────────────────────

export async function listarCategorias(tipo?: "receita" | "despesa"): Promise<CategoriaDB[]> {
  await garantirTabelas();
  const sql = db();
  const rows = tipo
    ? await sql`SELECT * FROM categorias WHERE tipo = ${tipo} ORDER BY ordem ASC, nome ASC`
    : await sql`SELECT * FROM categorias ORDER BY tipo ASC, ordem ASC, nome ASC`;
  return rows.map((r) => toCat(r as Record<string, unknown>));
}

export async function adicionarCategoria(tipo: "receita" | "despesa", nome: string): Promise<CategoriaDB> {
  const sql = db();
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO categorias (id, tipo, nome, ativo, ordem)
    VALUES (${id}, ${tipo}, ${nome.trim()}, TRUE,
      (SELECT COALESCE(MAX(ordem), -1) + 1 FROM categorias WHERE tipo = ${tipo}))
    RETURNING *
  `;
  return toCat(row as Record<string, unknown>);
}

export async function atualizarCategoria(
  id: string,
  dados: Partial<{ nome: string; ativo: boolean }>
): Promise<CategoriaDB | null> {
  const sql = db();
  const nome  = dados.nome  ?? null;
  const ativo = dados.ativo ?? null;
  const rows = await sql`
    UPDATE categorias SET
      nome  = COALESCE(${nome}::TEXT,    nome),
      ativo = COALESCE(${ativo}::BOOLEAN, ativo)
    WHERE id = ${id}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return toCat(rows[0] as Record<string, unknown>);
}

// ─── Configurações gerais ─────────────────────────────────────────────────────

export async function listarConfiguracoes(): Promise<Configuracoes> {
  await garantirTabelas();
  const sql = db();
  const rows = await sql`SELECT chave, valor FROM configuracoes`;
  return Object.fromEntries(rows.map((r) => [r.chave as string, r.valor as string]));
}

export async function salvarConfiguracao(chave: string, valor: string): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO configuracoes (chave, valor) VALUES (${chave}, ${valor})
    ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
  `;
}
