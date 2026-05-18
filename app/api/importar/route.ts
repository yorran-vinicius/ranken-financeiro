import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
// PDF analysis pode ser lento — amplia timeout para 120s
export const maxDuration = 120;

const PROMPT = `Analise este PDF e extraia todos os lançamentos financeiros. Para cada um retorne JSON com:
- descricao (string, obrigatório)
- valor (número positivo, obrigatório)
- tipo ("entrada" ou "saida", obrigatório)
- categoria_sugerida (uma de: Mensalidades, Patrocínios, Loja, Confraternização, Time, Marketing, Tecnologia, Operacional, Outros)
- data (YYYY-MM-DD se encontrada, senão null)

Retorne APENAS o JSON array sem texto adicional, markdown ou blocos de código.`;

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

  let texto: string;
  try {
    const conteudo: Anthropic.Messages.ContentBlockParam[] = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf" as const,
          data: pdf,
        },
        title: nome ?? "Documento",
      } as Anthropic.Messages.DocumentBlockParam,
      { type: "text", text: PROMPT },
    ];

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: conteudo }],
    });
    const bloco = msg.content.find((c) => c.type === "text");
    texto = bloco && bloco.type === "text" ? bloco.text : "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ erro: `Erro na API Anthropic: ${msg}` }, { status: 502 });
  }

  // Extrai o array JSON da resposta (ignora possível texto extra)
  const match = texto.match(/\[[\s\S]*\]/);
  if (!match) {
    return NextResponse.json(
      { erro: "A IA não retornou um JSON válido.", raw: texto.slice(0, 500) },
      { status: 422 },
    );
  }

  let lancamentos: LancamentoSugerido[];
  try {
    lancamentos = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ erro: "Falha ao parsear JSON da IA.", raw: match[0].slice(0, 500) }, { status: 422 });
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
