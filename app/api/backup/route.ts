import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getSession } from '@/lib/auth'
import { registrarAuditoria } from '@/lib/auditoria'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function db() {
  return neon(process.env.DATABASE_URL!)
}

/**
 * GET /api/backup
 * Exporta um backup completo em JSON (master only).
 * Inclui: lancamentos, categorias, stripe_assinaturas, stripe_repasses,
 *         meses_fechados, regras_categorizacao.
 */
export async function GET() {
  const sessao = await getSession()
  if (!sessao.userId || sessao.perfil !== 'master') {
    return NextResponse.json({ error: 'Somente masters podem exportar backup' }, { status: 403 })
  }

  const sql = db()

  const [
    lancamentos,
    categorias,
    assinaturas,
    repasses,
    mesesFechados,
    regras,
    usuarios,
  ] = await Promise.all([
    sql`SELECT * FROM lancamentos ORDER BY data DESC`,
    sql`SELECT * FROM categorias ORDER BY tipo, nome`,
    sql`SELECT * FROM stripe_assinaturas ORDER BY data_inicio DESC`,
    sql`SELECT * FROM stripe_repasses ORDER BY data_pagamento DESC`,
    sql`SELECT * FROM meses_fechados ORDER BY mes DESC`,
    sql`SELECT * FROM regras_categorizacao ORDER BY criado_em DESC`,
    sql`SELECT id, login, nome, perfil, ativo, criado_em FROM usuarios ORDER BY nome`,
  ])

  const payload = {
    versao: '2.0',
    gerado_em: new Date().toISOString(),
    gerado_por: sessao.nome,
    resumo: {
      total_lancamentos:  lancamentos.length,
      total_categorias:   categorias.length,
      total_assinaturas:  assinaturas.length,
      total_repasses:     repasses.length,
      meses_fechados:     mesesFechados.length,
    },
    dados: {
      lancamentos,
      categorias,
      stripe_assinaturas: assinaturas,
      stripe_repasses:    repasses,
      meses_fechados:     mesesFechados,
      regras_categorizacao: regras,
      usuarios,
    },
  }

  // Registra auditoria do backup (fire-and-forget)
  void registrarAuditoria({
    usuario_id:   sessao.userId,
    usuario_nome: sessao.nome,
    acao:         'backup',
    entidade:     'sistema',
    detalhes:     { lancamentos: lancamentos.length, assinaturas: assinaturas.length },
  })

  const nomeArquivo = `ranken-backup-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
    },
  })
}
