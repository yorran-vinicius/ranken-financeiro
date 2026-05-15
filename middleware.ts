import { unsealData } from "iron-session";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, DEV_SECRET, type SessionData } from "@/lib/auth";

const PUBLIC_PREFIXES = ["/login", "/api/auth/login"];

async function lerSessao(req: NextRequest): Promise<SessionData | null> {
  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const data = await unsealData<SessionData>(cookie, {
      password: process.env.SESSION_SECRET ?? DEV_SECRET,
    });
    return data.userId ? data : null;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const sessao = await lerSessao(req);

  if (!sessao) {
    const isApi = pathname.startsWith("/api/");
    if (isApi) {
      return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (sessao.deveAtualizarSenha && pathname !== "/trocar-senha") {
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/trocar-senha", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
