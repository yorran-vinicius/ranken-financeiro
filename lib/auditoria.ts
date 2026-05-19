import { neon } from '@neondatabase/serverless'

function db() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não configurado')
  return neon(url)
}

interface RegistroParams {
  usuario_id: string
  usuario_nome: string
  acao: string         // criar | editar | deletar | importar | fechar_mes | reabrir_mes | backup
  entidade: string     // lancamento | categoria | configuracao | mes | importacao
  entidade_id?: string
  detalhes?: Record<string, unknown>
  ip?: string
}

export async function registrarAuditoria(params: RegistroParams): Promise<void> {
  try {
    const sql = db()
    await sql`
      INSERT INTO auditoria
        (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes, ip)
      VALUES
        (${params.usuario_id},
         ${params.usuario_nome},
         ${params.acao},
         ${params.entidade},
         ${params.entidade_id ?? null},
         ${JSON.stringify(params.detalhes ?? {})}::jsonb,
         ${params.ip ?? null})
    `
  } catch (err) {
    // Auditoria nunca deve quebrar a operação principal
    console.error('[auditoria] Falha ao registrar:', err)
  }
}
