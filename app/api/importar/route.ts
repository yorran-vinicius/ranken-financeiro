import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
// PDF analysis pode ser lento — amplia timeout para 120s
export const maxDuration = 120;

const PROMPT = `Analise este extrato bancário e extraia TODOS os lançamentos. Ignore saldos do dia e saldo anterior. Para cada transação retorne um array JSON com objetos contendo:
descricao (string), valor (número positivo), tipo ("entrada" ou "saida"), categoria_sugerida (uma de: Mensalidades, Patrocínios, Loja, Confraternização, Time, Marketing, Tecnologia, Operacional, Outros), data (formato YYYY-MM-DD).
Retorne APENAS o array JSON, sem texto.`;

export interface LancamentoSugerido {
  descricao: string;
  valor: number;
  tipo: "entrada" | "saida";
  categoria_sugerida: string;
  data: string | null;
}

export async function POST(req: NextRequest) {
  await getSession(); // exige autenticação

  let body: { pdf?: string; nome?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { pdf, nome } = body;
  if (!pdf || typeof pdf !== "string") {
    return NextResponse.json({ erro: "Campo 'pdf' (base64) obrigatório" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ erro: "ANTHROPIC_API_KEY não configurado no servidor" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  // ── Chama a API Anthropic ─────────────────────────────────────────────────
  let msgContent: Anthropic.Messages.ContentBlock[];
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf" as const,
                data: pdf,
              },
            } as Anthropic.Messages.DocumentBlockParam,
            {
              type: "text",
              text: PROMPT,
            },
          ] as Anthropic.Messages.ContentBlockParam[],
        },
      ],
    });
    msgContent = msg.content;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: `Erro na API Anthropic: ${errMsg}` }, { status: 502 });
  }

  // ── Extrai texto bruto (todos os blocos de texto concatenados) ───────────
  const rawText = msgContent
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.Messages.TextBlock).text)
    .join("");

  console.log("RAW:", rawText.substring(0, 200));

  // ── Remove markdown code blocks se existirem ─────────────────────────────
  const cleaned = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // ── Localiza o array JSON pelos delimitadores [ e ] ──────────────────────
  const startIndex = cleaned.indexOf("[");
  const endIndex   = cleaned.lastIndexOf("]");

  if (startIndex === -1 || endIndex === -1) {
    console.log("Resposta bruta da IA (sem JSON encontrado):", rawText);
    return NextResponse.json(
      { erro: "Não foi possível identificar lançamentos neste PDF. Tente com outro arquivo." },
      { status: 422 },
    );
  }

  const jsonString = cleaned.substring(startIndex, endIndex + 1);

  let lancamentos: LancamentoSugerido[];
  try {
    lancamentos = JSON.parse(jsonString);
  } catch (parseErr) {
    console.log("Resposta bruta da IA (falha no parse):", rawText);
    console.log("Trecho extraído:", jsonString.slice(0, 500));
    console.log("Erro:", parseErr);
    return NextResponse.json(
      { erro: "Não foi possível identificar lançamentos neste PDF. Tente com outro arquivo." },
      { status: 422 },
    );
  }

  // Sanitiza e valida cada item
  const CATS_RECEITA = new Set(["Mensalidades", "Patrocínios", "Loja", "Confraternização", "Outros"]);
  const CATS_DESPESA = new Set(["Time", "Marketing", "Tecnologia", "Operacional", "Confraternização", "Outros"]);

  const resultado: LancamentoSugerido[] = lancamentos
    .filter((l) => l && typeof l.descricao === "string" && l.valor > 0)
    .map((l) => {
      const tipo: "entrada" | "saida" = l.tipo === "entrada" ? "entrada" : "saida";
      const cats = tipo === "entrada" ? CATS_RECEITA : CATS_DESPESA;
      const cat = cats.has(l.categoria_sugerida) ? l.categoria_sugerida : "Outros";
      return {
        descricao: String(l.descricao).trim(),
        valor: Math.round(Number(l.valor) * 100) / 100,
        tipo,
        categoria_sugerida: cat,
        data: typeof l.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.data) ? l.data : null,
      };
    });

  return NextResponse.json(resultado);
}
