/**
 * layout.tsx — apps/admin root layout
 *
 * Mirrors apps/landing/src/app/layout.tsx: Geist + Geist Mono, ThemeProvider.
 * No AI providers, no Botsson, no walkie. Admin portal only.
 */
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://admin.smartout.ai"),
  title: "Smartout Admin",
  description: "Regnskapsportal for Smartout — ordre og fakturaer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
