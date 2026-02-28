import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: {
    template: "%s - Smartout Docs",
  },
  description: "Documentation for the Smartout Employee Readiness System",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const navbar = <Navbar logo={<span style={{ fontWeight: 800 }}>Smartout Docs</span>} />;
  const pageMap = await getPageMap();
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          footer={<Footer>&copy; {new Date().getFullYear()} Smartout AS</Footer>}
          docsRepositoryBase="https://github.com/smartout-ai/smartout_v3/tree/main/apps/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          pageMap={pageMap}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
