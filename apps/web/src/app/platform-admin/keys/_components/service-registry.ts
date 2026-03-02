// ---------------------------------------------------------------------------
// Service Registry — 19 predefined platform services
// ---------------------------------------------------------------------------

export type ServiceTag =
  | "supabase"
  | "ai"
  | "billing"
  | "notifications"
  | "contracts"
  | "monitoring"
  | "infra";

export type ServiceTab = "client" | "server" | "runtime" | "webhooks";

export type ServiceEntry = {
  key: string;
  provider: string;
  envVar: string;
  label: string;
  tag: ServiceTag;
  tab: ServiceTab;
  prefix?: string;
  docsUrl?: string;
};

export const SERVICE_REGISTRY: readonly ServiceEntry[] = [
  // --- Client Keys ---
  {
    key: "supabase_url",
    provider: "supabase",
    envVar: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase URL",
    tag: "supabase",
    tab: "client",
  },
  {
    key: "supabase_anon_key",
    provider: "supabase",
    envVar: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Supabase Anon Key",
    tag: "supabase",
    tab: "client",
    prefix: "eyJ",
  },
  {
    key: "posthog_key",
    provider: "posthog",
    envVar: "NEXT_PUBLIC_POSTHOG_KEY",
    label: "PostHog Project Key",
    tag: "monitoring",
    tab: "client",
    prefix: "phc_",
  },
  {
    key: "posthog_host",
    provider: "posthog",
    envVar: "NEXT_PUBLIC_POSTHOG_HOST",
    label: "PostHog Host",
    tag: "monitoring",
    tab: "client",
  },
  {
    key: "sentry_dsn",
    provider: "sentry",
    envVar: "NEXT_PUBLIC_SENTRY_DSN",
    label: "Sentry DSN",
    tag: "monitoring",
    tab: "client",
    prefix: "https://",
  },

  // --- Server Keys ---
  {
    key: "supabase_service_role",
    provider: "supabase",
    envVar: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase Service Role",
    tag: "supabase",
    tab: "server",
    prefix: "eyJ",
  },
  {
    key: "openrouter",
    provider: "openrouter",
    envVar: "OPENROUTER_API_KEY",
    label: "OpenRouter API Key",
    tag: "ai",
    tab: "server",
    prefix: "sk-or-",
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    key: "ultravox",
    provider: "ultravox",
    envVar: "ULTRAVOX_API_KEY",
    label: "Ultravox API Key",
    tag: "ai",
    tab: "server",
  },
  {
    key: "stripe_secret_key",
    provider: "stripe",
    envVar: "STRIPE_SECRET_KEY",
    label: "Stripe Secret Key",
    tag: "billing",
    tab: "server",
    prefix: "sk_",
    docsUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    key: "sendgrid_api_key",
    provider: "sendgrid",
    envVar: "SENDGRID_API_KEY",
    label: "SendGrid API Key",
    tag: "notifications",
    tab: "server",
    prefix: "SG.",
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
  },
  {
    key: "twilio_account_sid",
    provider: "twilio",
    envVar: "TWILIO_ACCOUNT_SID",
    label: "Twilio Account SID",
    tag: "notifications",
    tab: "server",
    prefix: "AC",
  },
  {
    key: "twilio_auth_token",
    provider: "twilio",
    envVar: "TWILIO_AUTH_TOKEN",
    label: "Twilio Auth Token",
    tag: "notifications",
    tab: "server",
  },
  {
    key: "docuseal",
    provider: "docuseal",
    envVar: "DOCUSEAL_API_KEY",
    label: "DocuSeal API Key",
    tag: "contracts",
    tab: "server",
    docsUrl: "https://www.docuseal.com/docs/api",
  },

  // --- Runtime Keys ---
  {
    key: "upstash_redis_url",
    provider: "upstash",
    envVar: "UPSTASH_REDIS_REST_URL",
    label: "Upstash Redis REST URL",
    tag: "infra",
    tab: "runtime",
    prefix: "https://",
  },
  {
    key: "upstash_redis_token",
    provider: "upstash",
    envVar: "UPSTASH_REDIS_REST_TOKEN",
    label: "Upstash Redis REST Token",
    tag: "infra",
    tab: "runtime",
  },
  {
    key: "jwt_secret",
    provider: "internal",
    envVar: "JWT_SECRET",
    label: "JWT Secret",
    tag: "infra",
    tab: "runtime",
  },
  {
    key: "session_secret",
    provider: "internal",
    envVar: "SESSION_SECRET",
    label: "Session Secret",
    tag: "infra",
    tab: "runtime",
  },

  // --- Webhooks & Tokens ---
  {
    key: "stripe_webhook_secret",
    provider: "stripe",
    envVar: "STRIPE_WEBHOOK_SECRET",
    label: "Stripe Webhook Secret",
    tag: "billing",
    tab: "webhooks",
    prefix: "whsec_",
  },
  {
    key: "docuseal_webhook_secret",
    provider: "docuseal",
    envVar: "DOCUSEAL_WEBHOOK_SECRET",
    label: "DocuSeal Webhook Secret",
    tag: "contracts",
    tab: "webhooks",
  },
] as const satisfies readonly ServiceEntry[];

export const SERVICE_MAP = new Map(SERVICE_REGISTRY.map((s) => [s.key, s]));

export const ENV_VAR_MAP = new Map(SERVICE_REGISTRY.map((s) => [s.envVar, s]));

export const TAG_LABELS: Record<ServiceTag, string> = {
  supabase: "Supabase",
  ai: "AI & Voice",
  billing: "Billing",
  notifications: "Notifications",
  contracts: "Contracts",
  monitoring: "Monitoring",
  infra: "Infrastructure",
};

export const TAB_LABELS: Record<ServiceTab, string> = {
  client: "Client Keys",
  server: "Server Keys",
  runtime: "Runtime Keys",
  webhooks: "Webhooks & Tokens",
};

export function getServicesForTab(tab: ServiceTab): ServiceEntry[] {
  return SERVICE_REGISTRY.filter((s) => s.tab === tab);
}

export function groupByTag(services: ServiceEntry[]): Map<ServiceTag, ServiceEntry[]> {
  const groups = new Map<ServiceTag, ServiceEntry[]>();
  for (const service of services) {
    const list = groups.get(service.tag) ?? [];
    list.push(service);
    groups.set(service.tag, list);
  }
  return groups;
}
