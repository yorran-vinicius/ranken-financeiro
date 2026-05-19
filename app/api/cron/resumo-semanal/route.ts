import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'
import { enviarEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

function db() {
  return neon(process.env.DATABASE_URL!)
}

function brl(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const sql = db()
  const hoje  = new Date()
  const semAntStr = new Date(hoje.getTime() - 7 * 86400000).toISOString().slice(0, 10)
  const hojeStr   = hoje.toISOString().slice(0, 10)

  try {
    // Busca dados da semana
    const [entradas, saidas, novas, cancelamentos, mrr] = await Promise.all([
      sql`SELECT COALESCE(SUM(valor),0) as total FROM lancamentos WHERE tipo = 'receita' AND cancelado = FALSE AND data >= ${semAntStr} AND data <= ${hojeStr}`,
      sql`SELECT COALESCE(SUM(valor),0) as total FROM lancamentos WHERE tipo = 'despesa' AND cancelado = FALSE AND data >= ${semAntStr} AND data <= ${hojeStr}`,
      sql`SELECT COUNT(*)::int as qtd, COALESCE(SUM(valor_mensal),0) as valor FROM stripe_assinaturas WHERE data_inicio >= ${semAntStr}::date`,
      sql`SELECT COUNT(*)::int as qtd, COALESCE(SUM(valor_mensal),0) as valor FROM stripe_assinaturas WHERE data_cancelamento >= ${semAntStr}::date`,
      sql`SELECT COUNT(*)::int as ativas, COALESCE(SUM(valor_mensal),0) as mrr FROM stripe_assinaturas WHERE status = 'active'`,
    ])

    const totalEntradas   = Number(entradas[0]?.total ?? 0)
    const totalSaidas     = Number(saidas[0]?.total ?? 0)
    const novasQtd        = Number(novas[0]?.qtd ?? 0)
    const cancelQtd       = Number(cancelamentos[0]?.qtd ?? 0)
    const mrrAtual        = Number(mrr[0]?.mrr ?? 0)
    const ativas          = Number(mrr[0]?.ativas ?? 0)

    const dados = {
      periodo: `${semAntStr} a ${hojeStr}`,
      receitas_semana: brl(totalEntradas),
      despesas_semana: brl(totalSaidas),
      saldo_semana: brl(totalEntradas - totalSaidas),
      novas_assinaturas: novasQtd,
      cancelamentos: cancelQtd,
      mrr_atual: brl(mrrAtual),
      assinantes_ativos: ativas,
    }

    // Gera resumo com IA
    const client = new Anthropic()
    let resumoIA = ''

    try {
      const response = await client.messages.create({
        model:      'claude-sonnet-4-5-20250929',
        max_tokens: 250,
        messages: [{
          role:    'user',
          content: `Você é o assistente financeiro do RANKEN, comunidade de esportes de raquete. Escreva um resumo executivo semanal em 3-4 frases, tom direto e humano, sem bullet points. Dados da semana: ${JSON.stringify(dados)}`,
        }],
      })
      const bloco = response.content.find((b) => b.type === 'text')
      if (bloco?.type === 'text') resumoIA = bloco.text
    } catch { /* sem IA, envia sem resumo */ }

    await enviarEmail({
      assunto: `📊 Resumo semanal RANKEN — ${semAntStr} a ${hojeStr}`,
      titulo:  'Resumo da semana',
      corpo: `
        ${resumoIA ? `<p style="margin-bottom:16px">${resumoIA}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#6b7280">Receitas da semana</td><td style="text-align:right;font-weight:600;color:#3B6D11">${dados.receitas_semana}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Despesas da semana</td><td style="text-align:right;font-weight:600;color:#A32D2D">${dados.despesas_semana}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Saldo da semana</td><td style="text-align:right;font-weight:700">${dados.saldo_semana}</td></tr>
          <tr><td colspan="2" style="border-top:1px solid #e5e7eb;padding-top:8px"></td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">MRR atual</td><td style="text-align:right;font-weight:600">${dados.mrr_atual}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Assinantes ativos</td><td style="text-align:right;font-weight:600">${ativas}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Novas assinaturas</td><td style="text-align:right;font-weight:600;color:#3B6D11">+${novasQtd}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280">Cancelamentos</td><td style="text-align:right;font-weight:600;color:#A32D2D">-${cancelQtd}</td></tr>
        </table>
      `,
      tipo: 'resumo',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[cron-resumo-semanal]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
