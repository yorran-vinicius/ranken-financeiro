import { neon } from '@neondatabase/serverless'
import { calcularSimilaridade } from './padroes'

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')
  return neon(url)
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export interface LancamentoExistente {
  id: string
  descricao: string
  valor: number
  data: string
  categoria: string
}

export interface ResultadoVerificacao {
  isDuplicata: boolean
  lancamentoExistente?: LancamentoExistente
  similaridade?: number
  mensagem?: string
}

/**
 * Verifica se um lançamento já existe no banco para o mesmo mês.
 * @param tipo 'receita' | 'despesa' (convenção do banco)
 */
export async function verificarDuplicata(
  descricao: string,
  valor: number,
  tipo: string,  // 'receita' | 'despesa'
  data: string,  // YYYY-MM-DD
): Promise<ResultadoVerificacao> {
  const sql = db()

  // Extrai YYYY-MM da data
  const anoMes = data.slice(0, 7)

  // Busca lançamentos do mesmo mês, tipo e valor próximo (±5%)
  const existentes = await sql`
    SELECT l.id, l.descricao, l.valor, l.data, l.categoria
    FROM lancamentos l
    WHERE
      l.tipo      = ${tipo}
      AND l.cancelado = FALSE
      AND l.data LIKE ${anoMes + '%'}
      AND ABS(l.valor::numeric - ${valor}::numeric) / GREATEST(l.valor::numeric, 1) <= 0.05
    ORDER BY l.data DESC
  `

  for (const ex of existentes) {
    const similaridade = calcularSimilaridade(descricao, ex.descricao as string)

    if (similaridade >= 0.75) {
      const existente: LancamentoExistente = {
        id:        ex.id as string,
        descricao: ex.descricao as string,
        valor:     Number(ex.valor),
        data:      ex.data as string,
        categoria: ex.categoria as string,
      }
      return {
        isDuplicata:          true,
        lancamentoExistente:  existente,
        similaridade,
        mensagem:             `Possível duplicata: "${existente.descricao}" (${brl(existente.valor)}) já existe em ${anoMes}`,
      }
    }
  }

  return { isDuplicata: false }
}

/**
 * Verifica um lote de lançamentos.
 * Aceita tipo 'entrada' | 'saida' (de extratos bancários) e converte para 'receita' | 'despesa'.
 */
export async function verificarLote(lancamentos: Array<{
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida' | 'receita' | 'despesa'
  data: string
}>): Promise<Array<{ lancamento: (typeof lancamentos)[0]; resultado: ResultadoVerificacao }>> {
  const resultados = []

  for (const lancamento of lancamentos) {
    const tipoDb =
      lancamento.tipo === 'entrada' ? 'receita'
      : lancamento.tipo === 'saida' ? 'despesa'
      : lancamento.tipo

    const resultado = await verificarDuplicata(
      lancamento.descricao,
      lancamento.valor,
      tipoDb,
      lancamento.data,
    )
    resultados.push({ lancamento, resultado })
  }

  return resultados
}
