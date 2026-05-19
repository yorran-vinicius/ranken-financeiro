import { neon } from '@neondatabase/serverless'

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')
  return neon(url)
}

// ── Normalização de descrição ─────────────────────────────────────────────────

/** Normaliza descrição para comparação (remove números, datas, valores variáveis) */
export function normalizarDescricao(descricao: string): string {
  return descricao
    .toUpperCase()
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '') // remove datas dd/mm/yyyy
    .replace(/\d{2}\/\d{2}/g, '')          // remove datas dd/mm
    .replace(/R\$[\s\d.,]+/g, '')           // remove valores em BRL
    .replace(/[\d]{5,}/g, '')               // remove sequências numéricas longas (>= 5 dígitos)
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60)
}

/** Calcula similaridade entre duas strings (0 a 1) */
export function calcularSimilaridade(a: string, b: string): number {
  const na = normalizarDescricao(a)
  const nb = normalizarDescricao(b)

  if (na === nb) return 1
  if (na.length > 0 && nb.length > 0) {
    if (na.includes(nb) || nb.includes(na)) return 0.9
  }

  // Verifica palavras em comum (palavras com mais de 2 chars)
  const palavrasA = na.split(' ').filter((p) => p.length > 2)
  const palavrasB = nb.split(' ').filter((p) => p.length > 2)
  const emComum = palavrasA.filter((p) => palavrasB.includes(p))

  if (palavrasA.length === 0 || palavrasB.length === 0) return 0
  return emComum.length / Math.max(palavrasA.length, palavrasB.length)
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface RegraCategorizacao {
  id: number
  descricao_padrao: string
  descricao_original: string
  categoria_id: string | null
  categoria_nome: string | null
  tipo: string
  cidade: string | null
  valor_referencia: number | null
  tipo_lancamento: string
  vezes_confirmado: number
  ativo: boolean
}

// ── Busca ─────────────────────────────────────────────────────────────────────

/** Busca padrão existente para uma descrição + tipo ('receita' | 'despesa') */
export async function buscarPadraoExistente(
  descricao: string,
  tipo: string,
): Promise<{ regra: RegraCategorizacao; similaridade: number } | null> {
  const sql = db()

  const regras = await sql`
    SELECT rc.*, c.nome as categoria_nome
    FROM regras_categorizacao rc
    LEFT JOIN categorias c ON rc.categoria_id = c.id
    WHERE rc.tipo = ${tipo} AND rc.ativo = true
    ORDER BY rc.vezes_confirmado DESC
  `

  for (const regra of regras) {
    const similaridade = calcularSimilaridade(descricao, regra.descricao_original as string)
    if (similaridade >= 0.75) {
      return {
        regra: {
          id:                 regra.id as number,
          descricao_padrao:   regra.descricao_padrao as string,
          descricao_original: regra.descricao_original as string,
          categoria_id:       (regra.categoria_id as string) ?? null,
          categoria_nome:     (regra.categoria_nome as string) ?? null,
          tipo:               regra.tipo as string,
          cidade:             (regra.cidade as string) ?? null,
          valor_referencia:   regra.valor_referencia != null ? Number(regra.valor_referencia) : null,
          tipo_lancamento:    (regra.tipo_lancamento as string) ?? 'recorrente',
          vezes_confirmado:   Number(regra.vezes_confirmado),
          ativo:              Boolean(regra.ativo),
        },
        similaridade,
      }
    }
  }

  return null
}

// ── Salvar/atualizar padrão ───────────────────────────────────────────────────

/** Salva ou atualiza regra após confirmação do usuário */
export async function salvarPadrao(dados: {
  descricao: string
  categoria_id: string
  tipo: string         // 'receita' | 'despesa'
  cidade?: string | null
  valor: number
  tipo_lancamento: string
}): Promise<void> {
  const sql = db()
  const padrao = normalizarDescricao(dados.descricao)

  const existentes = await sql`
    SELECT id FROM regras_categorizacao
    WHERE descricao_padrao = ${padrao} AND tipo = ${dados.tipo}
  `

  if (existentes.length > 0) {
    await sql`
      UPDATE regras_categorizacao
      SET vezes_confirmado = vezes_confirmado + 1,
          atualizado_em    = NOW()
      WHERE id = ${existentes[0].id as number}
    `
  } else {
    await sql`
      INSERT INTO regras_categorizacao
        (descricao_padrao, descricao_original, categoria_id, tipo, cidade, valor_referencia, tipo_lancamento)
      VALUES
        (${padrao}, ${dados.descricao}, ${dados.categoria_id}, ${dados.tipo},
         ${dados.cidade ?? null}, ${dados.valor}, ${dados.tipo_lancamento})
    `
  }
}
