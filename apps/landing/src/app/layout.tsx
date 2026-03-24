import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { createTranslator } from "@smartout/i18n";
import { MotionProvider } from "../components/motion-provider";
import { ThemeProvider } from "../components/theme-provider";
import { ConsentProvider, AnalyticsGate } from "../components/cookie-consent";
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

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const locale = (headersList.get("x-locale") ?? "nb") as "nb" | "en";
  const t = createTranslator(locale, "common");

  return {
    metadataBase: new URL("https://smartout.ai"),
    title: t("site.title"),
    description: t("site.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const locale = headersList.get("x-locale") ?? "nb";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`${geistSans.className} bg-background text-foreground antialiased selection:bg-orange-500/30`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ConsentProvider locale={locale as "nb" | "en"}>
            <MotionProvider>{children}</MotionProvider>
          </ConsentProvider>
        </ThemeProvider>
        <AnalyticsGate>
          <Analytics />
          <SpeedInsights />
        </AnalyticsGate>
      </body>
    </html>
  );
}
