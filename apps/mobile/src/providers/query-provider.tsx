/**
 * TanStack Query provider for the mobile app.
 * Configures default stale times and retry behavior suitable for mobile.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes — mobile users tolerate slightly stale data
      retry: 2,
      refetchOnWindowFocus: false, // RN doesn't have "window focus" in web sense
    },
    mutations: {
      retry: 0,
    },
  },
});

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
