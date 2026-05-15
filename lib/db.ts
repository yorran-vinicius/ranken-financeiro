import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import type { TipoLancamento } from "./categorias";

export interface Lancamento {
  id: string;
  descricao: string;
  valor: number;
  tipo: TipoLancamento;
  categoria: string;
  data: string;
  criadoEm: string;
}

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurado");
  return neon(url);
}

async function garantirTabela() {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id         TEXT          PRIMARY KEY,
      descricao  TEXT          NOT NULL,
      valor      NUMERIC(12,2) NOT NULL,
      tipo       TEXT          NOT NULL,
      categoria  TEXT          NOT NULL,
      data       TEXT          NOT NULL,
      criado_em  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;
}

function toRow(row: Record<string, unknown>): Lancamento {
  const d = row.criado_em;
  return {
    id:        row.id as string,
    descricao: row.descricao as string,
    valor:     Number(row.valor),
    tipo:      row.tipo as TipoLancamento,
    categoria: row.categoria as string,
    data:      row.data as string,
    criadoEm:  (d instanceof Date ? d : new Date(d as string)).toISOString(),
  };
}

export async function lerLancamentos(): Promise<Lancamento[]> {
  await garantirTabela();
  const sql = db();
  const rows = await sql`
    SELECT * FROM lancamentos ORDER BY data DESC, criado_em DESC
  `;
  return rows.map(toRow);
}

export async function adicionarLancamento(
  input: Omit<Lancamento, "id" | "criadoEm">
): Promise<Lancamento> {
  await garantirTabela();
  const sql = db();
  const id = randomUUID();
  const [row] = await sql`
    INSERT INTO lancamentos (id, descricao, valor, tipo, categoria, data)
    VALUES (${id}, ${input.descricao}, ${input.valor}, ${input.tipo}, ${input.categoria}, ${input.data})
    RETURNING *
  `;
  return toRow(row);
}

export async function removerLancamento(id: string): Promise<boolean> {
  const sql = db();
  const result = await sql`
    DELETE FROM lancamentos WHERE id = ${id} RETURNING id
  `;
  return result.length > 0;
}

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
