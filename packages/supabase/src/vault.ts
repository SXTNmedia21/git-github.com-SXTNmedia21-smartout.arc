/**
 * Structural type for any Supabase client that supports `.rpc()`.
 * Uses a structural type instead of importing SupabaseClient directly
 * to avoid version mismatches across the monorepo.
 * PromiseLike (not Promise) because Supabase rpc() returns a PostgrestFilterBuilder.
 */
type SupabaseRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const cache = new Map<string, string>();

/**
 * Fetches an external secret from Supabase Vault via the `get_secret()` RPC.
 * Requires a service-role client (the RPC is SECURITY DEFINER, service_role only).
 *
 * Results are cached in-memory for the lifetime of the process.
 * Use `clearServiceKeyCache()` if you need to force a re-fetch (e.g. after rotation).
 *
 * @param client - Supabase client with service role privileges
 * @param secretName - The vault secret name (e.g. "openrouter", "ultravox", "docuseal")
 * @returns The decrypted secret value
 * @throws If the secret is not found or the RPC call fails
 */
export async function getServiceKey(
  client: SupabaseRpcClient,
  secretName: string,
): Promise<string> {
  const cached = cache.get(secretName);
  if (cached) return cached;

  const { data, error } = await client.rpc("get_secret", {
    secret_name: secretName,
  });

  if (error) {
    throw new Error(`Vault: failed to fetch "${secretName}": ${error.message}`);
  }
  if (!data) {
    throw new Error(`Vault: secret "${secretName}" not found`);
  }

  cache.set(secretName, data as string);
  return data as string;
}

/**
 * Clears the in-memory vault cache.
 * Call after secret rotation to force re-fetching on next access.
 */
export function clearServiceKeyCache(): void {
  cache.clear();
}
