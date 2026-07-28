import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";

// Self-hosted at build time — no external request at runtime (the app is framed
// inside GHL under a strict CSP).
const display = Outfit({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "Spark Saúde — Dashboard da Corretora",
  description: "Painel de carteira, renovações e pipeline de seguro saúde, embutido no GoHighLevel.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={display.variable}>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
