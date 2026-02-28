import { env } from "@/env";

/**
 * Call the contract microservice (services/contract-service).
 * Throws if the microservice is not configured (env vars missing).
 */
export async function callContractService(path: string, options?: RequestInit): Promise<Response> {
  const url = env.CONTRACT_SERVICE_URL;
  const key = env.CONTRACT_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      "Contract service not configured (CONTRACT_SERVICE_URL / CONTRACT_SERVICE_KEY missing)",
    );
  }

  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      "X-Service-Key": key,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
}

/**
 * Check if the contract microservice is configured.
 */
export function isContractServiceConfigured(): boolean {
  return Boolean(env.CONTRACT_SERVICE_URL && env.CONTRACT_SERVICE_KEY);
}
