import type { ReactNode } from "react";

export const revalidate = 3600; // ISR: 1 hour

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
