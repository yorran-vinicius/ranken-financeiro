import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { buscarUsuarioPorLogin, garantirTabelas } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ── Rate limiter em memória ───────────────────────────────────────────────────
// 5 tentativas por IP em 15 minutos.
// Em ambientes serverless com múltiplas instâncias, o limite é por instância,
// mas ainda mitiga ataques de força bruta vindos de um único cliente.

const JANELA_MS = 15 * 60 * 1_000; // 15 minutos
const MAX_TENTS = 5;

interface EntradaTaxa { count: number; resetAt: number; }
const rateMap = new Map<string, EntradaTaxa>();

function obterIP(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0] : req.headers.get("x-real-ip") ?? "unknown")
    .trim().toLowerCase();
}

/** true = permitido, false = bloqueado. */
function verificarRateLimit(ip: string): boolean {
  const agora = Date.now();
  const entrada = rateMap.get(ip);

  if (!entrada || agora > entrada.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: agora + JANELA_MS });
    return true;
  }
  if (entrada.count >= MAX_TENTS) return false;
  entrada.count++;
  return true;
}

/** Remove entradas expiradas para não acumular memória. */
function limparRateMap() {
  const agora = Date.now();
  for (const [ip, e] of rateMap.entries()) {
    if (agora > e.resetAt) rateMap.delete(ip);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = obterIP(req);

  if (rateMap.size > 500) limparRateMap();

  if (!verificarRateLimit(ip)) {
    return NextResponse.json(
      { erro: "Muitas tentativas. Tente novamente em 15 minutos." },
      {
        status: 429,
        headers: {
          "Retry-After":           String(JANELA_MS / 1_000),
          "X-RateLimit-Limit":     String(MAX_TENTS),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ erro: "JSON inválido" }, { status: 400 }); }

  const { login, senha } = body as Record<string, string>;
  if (!login || !senha) {
    return NextResponse.json({ erro: "Login e senha obrigatórios" }, { status: 400 });
  }

  await garantirTabelas();
  const usuario = await buscarUsuarioPorLogin(login.trim().toLowerCase());

  // Compara o hash mesmo quando o usuário não existe — evita timing attack
  const hashFake = "$2b$10$invalidhashtopreventtimingattXXXXXXXXXXXXXXXXXX";
  const ok = await compare(senha, usuario?.senhaHash ?? hashFake);

  if (!usuario || !ok) {
    return NextResponse.json({ erro: "Credenciais inválidas" }, { status: 401 });
  }

  if (!usuario.ativo) {
    return NextResponse.json({ erro: "Conta desativada" }, { status: 403 });
  }

  // Login bem-sucedido — zera contador deste IP
  rateMap.delete(ip);

  const sessao = await getSession();
  sessao.userId             = usuario.id;
  sessao.login              = usuario.login;
  sessao.nome               = usuario.nome;
  sessao.perfil             = usuario.perfil;
  sessao.deveAtualizarSenha = usuario.deveAtualizarSenha;
  await sessao.save();

  return NextResponse.json({
    id:                 usuario.id,
    login:              usuario.login,
    nome:               usuario.nome,
    perfil:             usuario.perfil,
    deveAtualizarSenha: usuario.deveAtualizarSenha,
  });
}
