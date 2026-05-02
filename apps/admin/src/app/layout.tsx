/**
 * layout.tsx — apps/admin root layout
 *
 * Mirrors apps/landing/src/app/layout.tsx: Geist + Geist Mono, ThemeProvider.
 * No AI providers, no Botsson, no walkie. Admin portal only.
 *
 * Inline <script> patches performance.measure SYNCHRONOUSLY before any
 * React/Next code runs, swallowing the negative-timestamp DOMException
 * thrown by React 19 + Turbopack owner-stack tracing in dev. Production
 * is no-op (NODE_ENV check).
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

const PERF_MEASURE_POLYFILL = `
(function(){
  if (typeof performance === 'undefined' || !performance.measure) return;
  var orig = performance.measure.bind(performance);
  performance.measure = function() {
    try { return orig.apply(performance, arguments); }
    catch (e) {
      if (e && /negative time stamp|cannot have a negative/i.test(String(e.message||e))) return undefined;
      throw e;
    }
  };
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nb"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PERF_MEASURE_POLYFILL }} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
