/**
 * TanStack Query + MMKV cache integration.
 *
 * createCachedQuery() returns query options that:
 *   1. Use MMKV-cached data as placeholderData (instant UI on launch)
 *   2. Persist fresh server responses back to MMKV on success
 *
 * This gives the app a stale-while-revalidate pattern that works offline:
 * the user sees cached data immediately while TanStack Query fetches
 * fresh data in the background. If offline, cached data stays visible
 * with no loading spinners.
 */
import type { QueryFunction, QueryKey, UseQueryOptions } from "@tanstack/react-query";

import { cacheGet, cacheSet } from "./mmkv";

type CachedQueryParams<TData> = {
  /** TanStack Query key — also used to derive the MMKV cache key */
  queryKey: QueryKey;
  /** The fetch function that calls Supabase */
  queryFn: QueryFunction<TData>;
  /** How long (ms) before cached data is considered stale. Defaults to 5 minutes. */
  staleTime?: number;
  /** Override the MMKV key. Defaults to `cache:${queryKey joined by ':'}` */
  cacheKey?: string;
};

/** Builds a stable MMKV key from a TanStack Query key array. */
function deriveCacheKey(queryKey: QueryKey): string {
  return `cache:${queryKey.map(String).join(":")}`;
}

/**
 * Returns UseQueryOptions with MMKV-backed placeholderData and auto-persist.
 *
 * Usage:
 * ```ts
 * const query = useQuery(createCachedQuery({
 *   queryKey: ['my-shifts'],
 *   queryFn: fetchMyShifts,
 *   staleTime: 5 * 60 * 1000,
 * }));
 * ```
 */
export function createCachedQuery<TData>({
  queryKey,
  queryFn,
  staleTime = 5 * 60 * 1000,
  cacheKey,
}: CachedQueryParams<TData>): UseQueryOptions<TData, Error, TData, QueryKey> {
  const key = cacheKey ?? deriveCacheKey(queryKey);

  const wrappedQueryFn: QueryFunction<TData> = async (context) => {
    const data = await queryFn(context);

    /* Persist the fresh response to MMKV for next launch / offline use */
    cacheSet(key, data);

    return data;
  };

  return {
    queryKey,
    queryFn: wrappedQueryFn,
    staleTime,
    /* Cache lookup returns TData | undefined which matches PlaceholderDataFunction.
     * The `as any` is needed because TanStack Query v5 uses NonFunctionGuard<TData>
     * which can't be satisfied when TData is an unconstrained generic. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placeholderData: ((_prev: unknown) => cacheGet<TData>(key)) as any,
  };
}
