"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

const ReactQueryDevtools = dynamic(
  () => import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
  { ssr: false },
);

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes — data stays fresh, no re-fetch on navigation
            gcTime: 10 * 60 * 1000, // 10 minutes — cache kept after last subscriber unmounts
            refetchOnWindowFocus: false,
            refetchOnMount: false, // prevents re-fetch when component remounts during navigation
            refetchOnReconnect: false, // prevents unnecessary refetch on network reconnect
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
