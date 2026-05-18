import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export interface LancamentoSugerido {
  descricao: string
  valor: number
  tipo: 'entrada' | 'saida'
  categoria_sugerida: string
  data: string | null
}

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json()

    if (!pdfBase64) {
      return NextResponse.json({ error: 'PDF não enviado' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf' as const,
              data: pdfBase64
            }
          } as Anthropic.Messages.DocumentBlockParam,
          {
            type: 'text',
            text: 'Analise este extrato bancário. Retorne SOMENTE um array JSON válido, sem markdown, sem texto antes ou depois. Cada objeto deve ter: descricao (string), valor (number positivo), tipo ("entrada" ou "saida"), categoria_sugerida (string), data (string YYYY-MM-DD ou null). Ignore linhas de saldo.'
          }
        ]
      }]
    })

    const textBlock = message.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Sem resposta da IA' }, { status: 422 })
    }

    const raw = textBlock.text
    console.log('RAW INICIO:', raw.substring(0, 100))

    const start = raw.indexOf('[')
    const end = raw.lastIndexOf(']')

    console.log('START:', start, 'END:', end)

    if (start === -1 || end === -1) {
      return NextResponse.json({ error: 'JSON não encontrado', raw: raw.substring(0, 200) }, { status: 422 })
    }

    const lancamentos = JSON.parse(raw.slice(start, end + 1))
    return NextResponse.json({ lancamentos })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('ERRO:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
