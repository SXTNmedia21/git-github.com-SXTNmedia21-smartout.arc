"use client";

/**
 * InviteTokenClient — owns everything interactive for /invite/[token].
 *
 * Mounted by the Server Component with a pre-resolved state. Responsibilities:
 *
 *   1. Call track_invitation_opened(p_token) RPC on mount (L-0090 timestamp
 *      tracking, Q6 lazy-opened-tracking). The RPC is idempotent and returns
 *      true only on first successful mark — we ONLY emit on true.
 *
 *   2. Emit "invitation opened" via telemetry — this is the sole producer of
 *      that event (L-0083 phantom-contract gate). Payload per registry
 *      (InvitationOpened): { entity: EntityRef, data: { invitation_id,
 *      workspace_id, token_preview } }. Per ADR-0167 the token is censored to
 *      its first 8 chars as `token_preview` — the raw token NEVER appears in
 *      emit payloads, console logs, or error breadcrumbs.
 *
 *   3. Render one of five states: valid_new_user, valid_existing_user,
 *      expired, used, invalid. Valid states use the workspace-tinted
 *      AuthBrandPanel + InvitationContextHeader; terminal states use a
 *      centered minimal card so we don't tease a workspace the user can't
 *      enter.
 *
 * The raw token is ALSO used to build /signup?invite=<token> and
 * /login?invite=<token> continuation URLs. This is intentional: the URL
 * already contained the token, so forwarding it in a same-origin navigation
 * does not widen exposure. It MUST NOT appear anywhere else.
 */

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, UserPlus } from "lucide-react";
import { emit, nonEmpty } from "@smartout/telemetry";
import { createClient } from "@smartout/supabase/client";
import { AuthBrandPanel } from "@/components/auth/AuthBrandPanel";
import { InvitationContextHeader } from "@/components/auth/InvitationContextHeader";
import type { InviteResolvedState } from "./page";

type Props = {
  /**
   * Raw invitation token. Required for the RPC call + continuation URLs.
   * NEVER passed into emit payloads — see top-of-file contract.
   */
  token: string;
  state: InviteResolvedState;
  /** Pre-localized role label (e.g. "Servitør") — empty string for terminal states. */
  roleLabel: string;
};

/**
 * Per ADR-0167: tokens are credentials. Any telemetry, logs, or external
 * surfaces must see only the first 8 chars. This helper centralizes the
 * redaction so it is grep-checkable from a single call site.
 */
function tokenPreview(token: string): string {
  // First 8 chars only — per ADR-0167 invitation-tokens-as-credentials.
  return token.slice(0, 8);
}

function formatExpiresAtNo(iso: string | null): string {
  if (!iso) return "tidligere";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "tidligere";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Best-effort Norwegian start-date string (day + month + year). */
function formatStartDateNo(iso: string): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return undefined;
  }
}

export function InviteTokenClient({ token, state, roleLabel }: Props) {
  const router = useRouter();

  // Guard against StrictMode double-mount in dev: we still want exactly one
  // RPC + one emit per real page visit. Strict re-invocation would double-
  // fire track_invitation_opened (harmless — idempotent) but could race the
  // emit. A ref gate is simpler than AbortController here.
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    // Only call the RPC on states where a row actually exists. For "invalid"
    // we skip entirely — there is no invitation to mark opened.
    if (state.kind === "invalid") return;

    // For "expired" and "used" we DO still call the RPC: it is idempotent
    // and will return false because the WHERE clause filters status='pending'
    // + expires_at > now(). False means no emit fires. This keeps the call
    // path uniform and lets any future "first-look-at-expired" signal be
    // added without changing this component.
    const supabase = createClient();

    void (async () => {
      const { data, error } = await supabase.rpc("track_invitation_opened", {
        p_token: token,
      });

      // Never log the token. Log only the redaction-safe preview.
      if (error) {
        console.warn(
          `[invite] track_invitation_opened failed for token ${tokenPreview(token)}…`,
          error.message,
        );
        return;
      }

      // RPC returns true only on the first successful mark. This is our
      // single producer of "invitation opened" — see file header.
      if (data !== true) return;

      // Valid states carry the workspace + invitation IDs we need. For
      // expired/used we have no IDs here, so we skip the emit (which also
      // won't fire because data would be false for those). Defensive.
      if (state.kind !== "valid_new_user" && state.kind !== "valid_existing_user") {
        return;
      }

      void emit({
        event: "invitation opened",
        workspace_id: nonEmpty(state.workspaceId, "workspace_id"),
        // Anonymous user at this point — no profile_id yet (variant B) or
        // not signed in (variant A). Registry routes this event to
        // posthog + logger only (NOT activity_trail) per ADR-0134 / L-0083,
        // so a string sentinel here is safe — the trail's NOT NULL UUID
        // constraint never sees this value. Empty string violates
        // `nonEmpty()` contract; "anonymous" is the documented sentinel.
        actor_id: nonEmpty("anonymous", "actor_id"),
        properties: {
          entity: {
            entity_type: "invitation",
            entity_id: state.invitationId,
          },
          data: {
            invitation_id: state.invitationId,
            workspace_id: state.workspaceId,
            // First 8 chars only — per ADR-0167.
            token_preview: tokenPreview(token),
          },
        },
      });
    })();
    // Intentionally run exactly once per mount — state/token are stable.
  }, [state, token]);

  if (state.kind === "invalid") {
    return (
      <InviteTerminalShell>
        <TerminalCard
          tone="destructive"
          icon={<AlertCircle className="h-7 w-7" aria-hidden />}
          title="Ugyldig invitasjonslenke"
          body="Vi kjenner ikke igjen denne lenken. Dobbeltsjekk e-posten eller be om en ny invitasjon."
          primaryHref="/login"
          primaryLabel="Gå til innlogging"
        />
      </InviteTerminalShell>
    );
  }

  if (state.kind === "expired") {
    return (
      <InviteTerminalShell>
        <TerminalCard
          tone="warning"
          icon={<Clock className="h-7 w-7" aria-hidden />}
          title="Invitasjonen er utløpt"
          body={`Denne lenken var gyldig til ${formatExpiresAtNo(state.expiresAt)}. Be inviteren sende en ny.`}
          primaryHref="/login"
          primaryLabel="Gå til innlogging"
        />
      </InviteTerminalShell>
    );
  }

  if (state.kind === "used") {
    const isAccepted = state.status === "accepted";
    return (
      <InviteTerminalShell>
        <TerminalCard
          tone="success"
          icon={<CheckCircle2 className="h-7 w-7" aria-hidden />}
          title={
            isAccepted
              ? "Denne invitasjonen er allerede brukt"
              : "Invitasjonen er ikke lenger aktiv"
          }
          body={
            isAccepted
              ? "Logg inn for å få tilgang til arbeidsflaten."
              : "Kontakt administratoren din hvis du fortsatt trenger tilgang."
          }
          primaryHref="/login"
          primaryLabel="Gå til innlogging"
        />
      </InviteTerminalShell>
    );
  }

  // --- Valid states (new user / existing user) ---
  const startDate = formatStartDateNo(state.expiresAt) // expiry isn't start date — leave unspecified.
    ? undefined
    : undefined;
  // Intentionally no start date in P1 — the invitation table does not carry
  // one. Leaving the prop undefined hides the chip suffix gracefully.
  void startDate;

  const continueQs = new URLSearchParams({ invite: token }).toString();
  const signupHref = `/signup?${continueQs}`;
  const loginHref = `/login?${continueQs}`;

  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel
        variant="workspace-invite"
        workspaceName={state.workspaceName}
        workspaceSlug={state.workspaceSlug}
        inviterName={state.inviterName}
        role={roleLabel}
      />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {/* Mobile logo — the brand panel is hidden below lg. */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>

        <div className="w-full max-w-[420px]">
          <div className="animate-auth-in mb-8" style={{ animationDelay: "80ms" }}>
            <InvitationContextHeader
              workspaceName={state.workspaceName}
              workspaceSlug={state.workspaceSlug}
              workspaceLogoUrl={state.workspaceLogoUrl ?? undefined}
              inviterName={state.inviterName}
              role={roleLabel}
            />
          </div>

          {state.kind === "valid_existing_user" ? (
            <ValidExistingUserPanel
              email={state.email}
              workspaceName={state.workspaceName}
              loginHref={loginHref}
              onNavigate={() => router.push(loginHref)}
            />
          ) : (
            <ValidNewUserPanel
              workspaceName={state.workspaceName}
              signupHref={signupHref}
              loginHref={loginHref}
              onNavigate={(href: string) => router.push(href)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Valid state panels ──────────────────────────────────────────────

type ValidNewUserPanelProps = {
  workspaceName: string;
  signupHref: string;
  loginHref: string;
  onNavigate: (href: string) => void;
};

function ValidNewUserPanel({
  workspaceName,
  signupHref,
  loginHref,
  onNavigate,
}: ValidNewUserPanelProps) {
  return (
    <div className="animate-auth-in flex flex-col gap-5" style={{ animationDelay: "500ms" }}>
      <div>
        <h2 className="font-heading text-foreground text-[1.5rem] leading-tight tracking-tight">
          Du er invitert til {workspaceName}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Opprett en Smartout-konto for å bli med i teamet. Det tar under et minutt.
        </p>
      </div>

      <button
        type="button"
        onClick={() => onNavigate(signupHref)}
        className="bg-brand-orange hover:bg-brand-orange/90 focus-visible:ring-brand-orange/40 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-[var(--shadow-cta-glow)] focus-visible:ring-4 focus-visible:outline-none"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Opprett konto og bli med
      </button>

      {/* Secondary path for the edge case where the user has a Smartout
          account on a different email — lets them log in and still pick up
          the invitation via ?invite= continuation. */}
      <Link
        href={loginHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 self-start text-sm transition-colors"
      >
        Har du allerede konto? Logg inn
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>

      <p className="text-muted-foreground/80 mt-2 text-xs leading-relaxed">
        Ved å opprette kontoen godtar du Smartouts vilkår og personvernregler.
      </p>
    </div>
  );
}

type ValidExistingUserPanelProps = {
  email: string;
  workspaceName: string;
  loginHref: string;
  onNavigate: () => void;
};

function ValidExistingUserPanel({
  email,
  workspaceName,
  loginHref,
  onNavigate,
}: ValidExistingUserPanelProps) {
  void loginHref;
  return (
    <div className="animate-auth-in flex flex-col gap-5" style={{ animationDelay: "500ms" }}>
      <div>
        <h2 className="font-heading text-foreground text-[1.5rem] leading-tight tracking-tight">
          Velkommen tilbake
          {email ? (
            <>
              ,&nbsp;<span className="font-mono text-[1.1rem]">{email}</span>
            </>
          ) : null}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Logg inn på den eksisterende Smartout-kontoen din for å godta invitasjonen.
        </p>
      </div>

      <button
        type="button"
        onClick={onNavigate}
        className="bg-brand-orange hover:bg-brand-orange/90 focus-visible:ring-brand-orange/40 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-[var(--shadow-cta-glow)] focus-visible:ring-4 focus-visible:outline-none"
      >
        Logg inn og bli med {workspaceName}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>

      <p className="text-muted-foreground/80 text-xs leading-relaxed">
        Vi legger til tilgang til {workspaceName} etter innlogging.
      </p>
    </div>
  );
}

// ─── Terminal state shell (expired / used / invalid) ─────────────────

function InviteTerminalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background relative flex min-h-[100dvh] overflow-hidden">
      <AuthBrandPanel variant="minimal" />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="absolute top-8 left-1/2 -translate-x-1/2 lg:hidden">
          <Image src="/smartout-logo.png" alt="Smartout" width={120} height={42} priority />
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}

type TerminalCardProps = {
  tone: "destructive" | "warning" | "success";
  icon: React.ReactNode;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
};

function TerminalCard({ tone, icon, title, body, primaryHref, primaryLabel }: TerminalCardProps) {
  // Tone maps to a subtle icon-badge background within the Nordic Split
  // palette — destructive for invalid, warning for expired, success-ish for
  // used-but-accepted. No hardcoded zinc/gray — all CSS variables.
  const toneClass =
    tone === "destructive"
      ? "bg-destructive/10 text-destructive"
      : tone === "warning"
        ? "bg-brand-orange/10 text-brand-orange"
        : "bg-muted text-foreground";

  return (
    <div
      className="animate-auth-in flex flex-col items-start gap-5"
      style={{ animationDelay: "80ms" }}
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${toneClass}`}>
        {icon}
      </div>

      <div>
        <h1 className="font-heading text-foreground text-[1.75rem] leading-[1.08] tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{body}</p>
      </div>

      <Link
        href={primaryHref}
        className="border-border bg-background hover:bg-muted text-foreground inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border px-5 text-sm font-semibold transition-colors"
      >
        {primaryLabel}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </div>
  );
}
