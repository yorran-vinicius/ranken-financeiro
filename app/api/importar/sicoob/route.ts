import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import * as XLSX from 'xlsx'
import { getSession } from '@/lib/auth'
import type { LancamentoSugerido } from '@/app/api/importar/route'
import { conciliarRepasseStripe } from '@/lib/stripeConciliacao'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tipos internos ────────────────────────────────────────────────────────────

interface LancamentoBruto {
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  data: string | null
}

// ── Helpers de data ───────────────────────────────────────────────────────────

/** Converte Date (UTC) em YYYY-MM-DD sem shift de fuso */
function dateToISO(d: Date): string {
  const ano = d.getUTCFullYear()
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(d.getUTCDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Converte número serial do Excel em YYYY-MM-DD */
function serialToISO(serial: number): string {
  // Excel epoch: 1 jan 1900 = serial 1, com o bug do 29/fev/1900 (serial 60)
  return dateToISO(new Date((serial - 25569) * 86400 * 1000))
}

/**
 * Converte data no formato brasileiro "DD/MM/YYYY" → "YYYY-MM-DD".
 * Retorna null se a string não bater com o padrão.
 */
function parseDateBR(raw: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim())
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

// ── Parse do valor Sicoob ─────────────────────────────────────────────────────
// Formatos: "475,20 C" | "- 300,00 D" | number positivo/negativo (xlsx já parseou)

function parseValorSicoob(raw: unknown): { valor: number; tipo: 'entrada' | 'saida' } | null {
  if (raw === null || raw === undefined || raw === '') return null

  // Célula numérica (xlsx já converteu)
  if (typeof raw === 'number') {
    if (isNaN(raw) || raw === 0) return null
    return { valor: Math.abs(raw), tipo: raw > 0 ? 'entrada' : 'saida' }
  }

  const s = String(raw).trim()
  const last = s.slice(-1).toUpperCase()
  if (last !== 'C' && last !== 'D') return null

  const tipo: 'entrada' | 'saida' = last === 'C' ? 'entrada' : 'saida'
  const numStr = s
    .slice(0, -1)
    .trim()
    .replace(/[\s-]/g, '') // remove espaços e sinal negativo
    .replace(/\./g, '')    // remove separador de milhar
    .replace(',', '.')     // decimal BR → US
  const valor = parseFloat(numStr)
  if (isNaN(valor) || valor <= 0) return null
  return { valor, tipo }
}

// ── Parser XLS/XLSX ───────────────────────────────────────────────────────────

function parseXLS(buffer: Buffer): LancamentoBruto[] {
  // cellDates: true converte células de data nativas do Excel para Date objects.
  // Células de texto que já têm "18/05/2026" permanecem como string — tratado abaixo.
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]

  // header: 1 → cada linha vira array preservando índices das colunas
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })

  // Linha 0 = "EXTRATO CONTA CORRENTE" (título), linha 1 = cabeçalho → pula ambas
  const dataRows = rows.slice(2) as unknown[][]

  interface GrupoTemp {
    data: string
    historico: string
    detalhes: string[]
    valor: { valor: number; tipo: 'entrada' | 'saida' }
  }

  const grupos: GrupoTemp[] = []
  let grupoAtual: GrupoTemp | null = null

  for (const row of dataRows) {
    const cell0 = row[0]

    // ── Detecta se é linha principal (DATA preenchida) ──────────────────────
    // O Sicoob exporta a coluna DATA como texto "DD/MM/YYYY".
    // xlsx pode entregar como: string (texto), Date (célula de data nativa)
    // ou number (serial Excel quando cellDates não reconhece o formato).

    let dataParsed: string | null = null

    if (typeof cell0 === 'string' && cell0.trim() !== '') {
      // Caso mais comum: string "18/05/2026"
      dataParsed = parseDateBR(cell0)
    } else if (cell0 instanceof Date) {
      // Célula de data nativa do Excel
      dataParsed = dateToISO(cell0)
    } else if (typeof cell0 === 'number' && !isNaN(cell0) && cell0 > 10000) {
      // Serial numérico do Excel (fallback raro)
      dataParsed = serialToISO(cell0)
    }

    const isMainRow = dataParsed !== null

    if (isMainRow) {
      const historico = String(row[2] ?? '').trim()

      // Ignora linhas de saldo do dia / saldo anterior
      if (!historico || historico.toUpperCase().includes('SALDO')) continue

      const valorParsed = parseValorSicoob(row[3])
      if (!valorParsed) continue

      grupoAtual = {
        data: dataParsed!,
        historico,
        detalhes: [],
        valor: valorParsed,
      }
      grupos.push(grupoAtual)
    } else if (grupoAtual) {
      // ── Linha de detalhe: DATA vazia → concatena ao lançamento anterior ──
      const detalhe = String(row[2] ?? '').trim()
      if (detalhe && !detalhe.toUpperCase().includes('SALDO')) {
        grupoAtual.detalhes.push(detalhe)
      }
    }
  }

  console.log(`[sicoob] XLS parse: ${grupos.length} lançamento(s) encontrado(s)`)

  return grupos.map((g) => ({
    // Detalhes concatenados com " - " para separar visualmente
    descricao: [g.historico, ...g.detalhes].filter(Boolean).join(' - ').trim(),
    valor:     g.valor.valor,
    tipo:      g.valor.tipo,
    data:      g.data,
  }))
}

// ── Parser OFX ────────────────────────────────────────────────────────────────

function parseOFX(text: string): LancamentoBruto[] {
  const result: LancamentoBruto[] = []

  // Extrai blocos <STMTTRN>...</STMTTRN> (case-insensitive)
  const matches = [...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)]

  for (const match of matches) {
    const block = match[1]

    const get = (tag: string) =>
      new RegExp(`<${tag}[^>]*>([^\\r\\n<]+)`, 'i').exec(block)?.[1]?.trim() ?? ''

    const trnType  = get('TRNTYPE')
    const dtPosted = get('DTPOSTED')
    const trnAmt   = get('TRNAMT')
    const name     = get('NAME')
    const memo     = get('MEMO')

    const descricao = name || memo
    if (!descricao) continue

    const valorRaw = parseFloat(trnAmt.replace(',', '.'))
    if (isNaN(valorRaw)) continue
    const valor = Math.abs(valorRaw)
    if (valor <= 0) continue

    const tipo: 'entrada' | 'saida' =
      valorRaw > 0 || trnType.toUpperCase() === 'CREDIT' ? 'entrada' : 'saida'

    // DTPOSTED: YYYYMMDD ou YYYYMMDDHHMMSS[.sss][+HH:MM]
    const ds = dtPosted.replace(/[^0-9]/g, '').slice(0, 8)
    const data =
      ds.length === 8
        ? `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`
        : null

    result.push({ descricao, valor, tipo, data })
  }

  return result
}

// ── Enriquecimento com IA (batch único) ───────────────────────────────────────

async function enriquecerComIA(
  lancamentos: LancamentoBruto[],
): Promise<LancamentoSugerido[]> {
  if (lancamentos.length === 0) return []

  const prompt = `Você analisa extratos bancários do Sicoob (cooperativa de crédito brasileira).
Para cada lançamento da lista, sugira exatamente:
  - "categoria": uma das categorias disponíveis (obrigatório)
  - "tipo_lancamento": "avulso" ou "recorrente"
  - "descricao_limpa": versão legível em português, sem abreviações bancárias, máx. 60 chars

Categorias disponíveis:
  ENTRADAS → Mensalidades | Patrocínios | Loja | Confraternização | Aporte | Outros
  SAÍDAS   → Time | Marketing | Tecnologia | Operacional | Confraternização | Outros

Retorne SOMENTE um JSON array com exatamente ${lancamentos.length} objetos na mesma ordem dos lançamentos abaixo. Sem markdown, sem texto extra.
Formato: [{"categoria":"...","tipo_lancamento":"avulso","descricao_limpa":"..."}]

Lançamentos:
${JSON.stringify(
  lancamentos.map((l, i) => ({
    i,
    tipo: l.tipo,
    valor: l.valor,
    descricao: l.descricao,
    data: l.data,
  })),
)}`

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text')
    throw new Error('Sem resposta da IA')

  const raw = textBlock.text
  const start = raw.indexOf('[')
  const end   = raw.lastIndexOf(']')
  if (start === -1 || end === -1)
    throw new Error('Resposta da IA não contém JSON válido')

  const sugestoes: Array<{
    categoria: string
    tipo_lancamento: string
    descricao_limpa: string
  }> = JSON.parse(raw.slice(start, end + 1))

  return lancamentos.map((l, i) => ({
    descricao:          sugestoes[i]?.descricao_limpa ?? l.descricao,
    valor:              l.valor,
    tipo:               l.tipo,
    categoria_sugerida: sugestoes[i]?.categoria ?? 'Outros',
    data:               l.data,
  }))
}

// ── Verificação de duplicatas ─────────────────────────────────────────────────

async function marcarDuplicatas(
  lancamentos: LancamentoSugerido[],
): Promise<LancamentoSugerido[]> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    return await Promise.all(
      lancamentos.map(async (l) => {
        if (!l.data) return { ...l, duplicata: false }
        const tipoDb = l.tipo === 'entrada' ? 'receita' : 'despesa'
        const rows = await sql`
          SELECT id FROM lancamentos
          WHERE valor     = ${l.valor}
            AND data      = ${l.data}
            AND tipo      = ${tipoDb}
            AND cancelado = FALSE
          LIMIT 1
        `
        return { ...l, duplicata: rows.length > 0 }
      }),
    )
  } catch (err) {
    console.error('[sicoob] Erro ao verificar duplicatas:', err)
    return lancamentos // continua sem marcar duplicatas
  }
}

// ── Conciliação Stripe ────────────────────────────────────────────────────────

async function conciliarStripe(
  lancamentos: LancamentoSugerido[],
): Promise<LancamentoSugerido[]> {
  try {
    return await Promise.all(
      lancamentos.map(async (l) => {
        // Só tenta conciliar entradas com data definida
        if (l.tipo !== 'entrada' || !l.data) return l
        // Heurística: descrição menciona Stripe, repasse, pagamento digital
        const desc = l.descricao.toUpperCase()
        const pareceStripe = desc.includes('STRIPE') || desc.includes('REPASSE') || desc.includes('MARKETPLACE')
        if (!pareceStripe) return l

        const resultado = await conciliarRepasseStripe(l.valor, l.data, l.descricao)
        if (resultado.encontrado && resultado.repasse_id) {
          const taxa = Number((resultado.repasse as Record<string, unknown>)?.valor_taxa ?? 0)
          return { ...l, stripe_repasse_id: resultado.repasse_id, stripe_taxa: taxa }
        }
        return l
      }),
    )
  } catch (err) {
    console.error('[sicoob] Erro na conciliação Stripe:', err)
    return lancamentos
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('arquivo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'O arquivo não pode ultrapassar 10 MB' },
        { status: 400 },
      )
    }

    const nome   = file.name.toLowerCase()
    const buffer = Buffer.from(await file.arrayBuffer())

    let brutos: LancamentoBruto[]

    if (nome.endsWith('.ofx')) {
      brutos = parseOFX(buffer.toString('utf-8'))
    } else if (nome.endsWith('.xls') || nome.endsWith('.xlsx')) {
      brutos = parseXLS(buffer)
    } else {
      return NextResponse.json(
        { error: 'Formato não suportado. Use .xls, .xlsx ou .ofx' },
        { status: 400 },
      )
    }

    if (brutos.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum lançamento encontrado no arquivo. Verifique se o formato está correto.' },
        { status: 422 },
      )
    }

    const enriquecidos    = await enriquecerComIA(brutos)
    const comDuplicatas   = await marcarDuplicatas(enriquecidos)
    const comConciliacao  = await conciliarStripe(comDuplicatas)

    return NextResponse.json({ lancamentos: comConciliacao })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[sicoob] ERRO:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
