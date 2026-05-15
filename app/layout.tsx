import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "RANKEN Financeiro",
  description: "Controle financeiro da RANKEN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans">
        <AuthProvider>
          <NavBar />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
            {children}
          </main>
          <footer className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-marca-texto-suave">
            RANKEN Financeiro · MVP
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
