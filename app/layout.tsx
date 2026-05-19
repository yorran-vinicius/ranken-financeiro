import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AuthProvider } from "@/components/AuthProvider";
import ClientLayout from "@/components/ClientLayout";
import RegisterSW from "@/components/RegisterSW";
import BannerInstalar from "@/components/BannerInstalar";

// ── PWA / SEO metadata ────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "RANKEN Financeiro",
  description: "Controle financeiro interno do RANKEN",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: "RANKEN",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

// theme-color vive em viewport no Next.js 14
export const viewport: Viewport = {
  themeColor: "#000000",
};

// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans">
        <AuthProvider>
          <BannerInstalar />
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
            {children}
          </main>
          <footer className="hidden md:block max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-marca-texto-suave">
            © RANKEN 2026
          </footer>
          <ClientLayout />
          <RegisterSW />
        </AuthProvider>
      </body>
    </html>
  );
}
