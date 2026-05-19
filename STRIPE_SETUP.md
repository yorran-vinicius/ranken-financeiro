# Configuração Stripe + Email — RANKEN Financeiro

## Variáveis de ambiente necessárias

Adicione as seguintes variáveis no painel do Vercel (**Settings → Environment Variables**) e também no `.env.local` para desenvolvimento local:

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...          # Chave secreta do Stripe (live)
STRIPE_WEBHOOK_SECRET=whsec_...        # Secret do webhook (obtido ao criar o endpoint)

# Resend (email transacional)
RESEND_API_KEY=re_...                  # Chave da API do Resend

# Destinatários dos alertas (separados por vírgula)
EMAIL_DESTINO=yorran@ranken.com.br,thales@ranken.com.br

# Cron jobs
CRON_SECRET=...                        # String aleatória usada para autenticar os crons
                                       # Gere com: openssl rand -hex 32
```

---

## Configurar o Webhook do Stripe

1. Acesse [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Clique em **"Add endpoint"**
3. URL do endpoint:
   ```
   https://SEU-DOMINIO.vercel.app/api/stripe/webhook
   ```
4. Selecione os eventos a escutar:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copie o **Signing secret** (`whsec_...`) e salve como `STRIPE_WEBHOOK_SECRET`

---

## Configurar os Crons no Vercel

O arquivo `vercel.json` já configura os crons:

| Cron | Schedule | Descrição |
|------|----------|-----------|
| `/api/cron/diario` | `0 11 * * *` | Diário às 8h (BRT) — verifica caixa negativo, repasses atrasados, assinantes inadimplentes |
| `/api/cron/resumo-semanal` | `0 11 * * 1` | Segunda-feira às 8h (BRT) — resumo semanal com IA |

**IMPORTANTE:** Os crons só funcionam em projetos com plano **Pro** do Vercel.

Configure o `CRON_SECRET` no painel do Vercel. O valor deve ser uma string longa e aleatória:

```bash
openssl rand -hex 32
```

---

## Configurar o Resend

1. Crie uma conta em [resend.com](https://resend.com)
2. Adicione e verifique seu domínio (ex: `ranken.com.br`)
3. Crie uma API Key e salve como `RESEND_API_KEY`
4. Configure `EMAIL_DESTINO` com os e-mails que devem receber os alertas

O remetente padrão está configurado como `noreply@ranken.com.br`. Altere em `lib/email.ts` se necessário.

---

## Sincronização inicial

Após configurar todas as variáveis, faça a sincronização inicial do histórico Stripe:

1. Acesse o sistema como usuário **master**
2. Vá em **Configurações** (ou acesse diretamente via API)
3. Execute: `POST /api/stripe/sincronizar`

Isso importa todas as assinaturas ativas/canceladas e os repasses dos últimos 3 meses.

---

## Fluxo de conciliação

```
Cliente paga → Stripe webhook → stripe_repasses (status: previsto, D+30)
                                      ↓
                         Importação do extrato Sicoob
                                      ↓
              Descrição contém "STRIPE"/"REPASSE" → conciliarRepasseStripe()
                                      ↓
                    Match encontrado → stripe_repasse_id retornado
                                      ↓
                 POST /api/stripe/confirmar-repasse → status: confirmado
                                      ↓
              Lançamento "Taxas Stripe" criado automaticamente (despesa)
```

---

## Estrutura das tabelas novas

| Tabela | Descrição |
|--------|-----------|
| `stripe_assinaturas` | Assinaturas Stripe sincronizadas |
| `stripe_repasses` | Repasses previstos/confirmados (D+30) |
| `auditoria` | Log de todas as ações sensíveis |
| `meses_fechados` | Meses com edição bloqueada + saldo consolidado |

---

## Testando localmente

Para testar webhooks localmente, use o [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copie o `whsec_...` exibido e use como `STRIPE_WEBHOOK_SECRET` no `.env.local`.
