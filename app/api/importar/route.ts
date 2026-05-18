import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
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
  await getSession();

  let body: { pdf?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const { pdf } = body;
  if (!pdf || typeof pdf !== "string") {
    return NextResponse.json({ error: "Campo 'pdf' obrigatório" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurado" }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  let response;
  try {
    response = await client.messages.create({
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
            { type: "text", text: PROMPT },
          ] as Anthropic.Messages.ContentBlockParam[],
        },
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro na API Anthropic: ${msg}` }, { status: 502 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgContent = response.content as any[];
  const fullText = msgContent
    .filter((b: any) => b.type === "text") // eslint-disable-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)               // eslint-disable-line @typescript-eslint/no-explicit-any
    .join("");

  console.log("RAW:", fullText.substring(0, 300));

  const start = fullText.indexOf("[");
  const end   = fullText.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) {
    return NextResponse.json(
      { error: "JSON não encontrado na resposta" },
      { status: 422 },
    );
  }

  const jsonStr     = fullText.slice(start, end + 1);
  const lancamentos = JSON.parse(jsonStr);

  return NextResponse.json({ lancamentos });
}
