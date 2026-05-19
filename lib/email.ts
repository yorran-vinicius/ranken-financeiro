import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface EmailParams {
  assunto: string
  titulo: string
  corpo: string
  tipo: 'alerta' | 'sucesso' | 'info' | 'resumo'
}

export async function enviarEmail({ assunto, titulo, corpo, tipo }: EmailParams): Promise<void> {
  const destinosRaw = process.env.EMAIL_DESTINO ?? ''
  const destinos = destinosRaw.split(',').map((e) => e.trim()).filter(Boolean)
  if (destinos.length === 0) {
    console.warn('[email] EMAIL_DESTINO não configurado — email não enviado')
    return
  }

  const cores: Record<string, string> = {
    alerta:  '#A32D2D',
    sucesso:  '#3B6D11',
    info:     '#1f2937',
    resumo:   '#1f2937',
  }

  const appUrl = process.env.APP_URL ?? 'https://ranken-financeiro.vercel.app'

  const html = `
    <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: #111; color: #fff; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <strong style="font-size: 18px; letter-spacing: -0.3px;">RANKEN Financeiro</strong>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 12px 12px; background: #fff;">
        <h2 style="color: ${cores[tipo]}; margin: 0 0 12px; font-size: 18px; font-weight: 700;">
          ${titulo}
        </h2>
        <p style="color: #374151; line-height: 1.6; font-size: 15px; margin: 0 0 16px;">
          ${corpo}
        </p>
        <a href="${appUrl}"
           style="display: inline-block; background: #111; color: #fff; padding: 10px 20px;
                  border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          Abrir o app
        </a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">
        Você recebe este email porque é responsável pelo RANKEN Financeiro.
      </p>
    </div>
  `.trim()

  try {
    await resend.emails.send({
      from: 'RANKEN Financeiro <financeiro@resend.dev>',
      to: destinos,
      subject: assunto,
      html,
    })
  } catch (err) {
    console.error('[email] Erro ao enviar:', err)
  }
}
