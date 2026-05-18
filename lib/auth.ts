import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId: string;
  login: string;
  nome: string;
  perfil: "master" | "editor";
  deveAtualizarSenha: boolean;
}

export const COOKIE_NAME = "ranken_sess";
// Fallback dev secret — set SESSION_SECRET in production
export const DEV_SECRET = "ranken-financeiro-secret-dev-key-32c";

export function sessionOpts() {
  const password = process.env.SESSION_SECRET ?? DEV_SECRET;

  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    console.warn(
      "\n[RANKEN] ⚠️  SESSION_SECRET não definido!\n" +
      "  Configure a variável SESSION_SECRET no Vercel com um valor aleatório de 32+ caracteres.\n" +
      "  Sem isso, todas as sessões são assinadas com um secret público — INSEGURO em produção.\n" +
      "  Gere um valor com: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n",
    );
  }

  return {
    password,
    cookieName: COOKIE_NAME,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax" as const,
    },
  } satisfies import("iron-session").SessionOptions & { cookieName: string };
}

/** Use in API route handlers — reads + writes via next/headers */
export async function getSession() {
  // cookies() from next/headers satisfies the CookieStore interface at runtime;
  // the cast is needed because TypeScript picks the wrong overload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return getIronSession<SessionData>(cookies() as any, sessionOpts());
}
