"use client";

/**
 * Join wizard definition — config object for WizardShell.
 *
 * 6-step join flow: Account → Business → Identity → Hours → Menu → Summary.
 * Auth (signUp/signInWithPassword) happens silently in step 1 after email+password entry.
 * Step 6 is a read-only review so the user can verify before workspace provisioning.
 * onComplete runs completeSignup server action and redirects to /onboarding.
 */

import type { WizardDefinition } from "@smartout/ui";
import type { JoinState } from "./types";
import { defaultJoinState } from "./types";
import { loadJoinState, saveJoinState, clearJoinState } from "./_lib/storage";
import { Step1Account } from "./_components/Step1Account";
import { Step2Business } from "./_components/Step2Business";
import { Step3About } from "./_components/Step3About";
import { Step4Hours } from "./_components/Step4Hours";
import { Step5Menu } from "./_components/Step5Menu";
import { Step6Summary } from "./_components/Step6Summary";
import { step1Schema, step2Schema, step3Schema, step4Schema, step5Schema } from "./_lib/validation";
import { completeSignup } from "./_lib/setupActions";
import { buildPostSignupRedirectPath } from "./_lib/onboarding-shell";
import { createClient } from "@smartout/supabase/client";

/**
 * Restore persisted state from localStorage via the versioned storage envelope.
 * Falls back to empty object when no valid, in-TTL envelope exists.
 *
 * When a valid envelope exists, computes the highest completed step by inspecting
 * which step-keys are non-empty and injects _initialStepIndex so WizardShell lands
 * on the correct step instead of always starting at Step 1 (ADR-0358).
 */
async function loadState(): Promise<Partial<JoinState>> {
  if (typeof window === "undefined") return {};
  const restored = loadJoinState();
  if (!restored) return {};

  // Step keys in wizard order (indices 0..5). "createAccount" is the data key
  // for Step 6 (Summary / create account), which is step index 5.
  const stepKeysInOrder: (keyof JoinState)[] = [
    "account",
    "business",
    "about",
    "hours",
    "menu",
    "createAccount",
  ];

  // Shortcut: if all three "landmark" fields are present, user reached Step 6+.
  const reachedSummary =
    typeof restored.account?.email === "string" &&
    restored.account.email.length > 0 &&
    typeof (restored.business as Record<string, unknown>)?.orgNumber === "string" &&
    ((restored.business as Record<string, unknown>).orgNumber as string).length > 0 &&
    typeof (restored.menu as Record<string, unknown>)?.restaurantType === "string" &&
    ((restored.menu as Record<string, unknown>).restaurantType as string).length > 0;

  let initialStepIndex: number;
  if (reachedSummary) {
    initialStepIndex = 5;
  } else {
    // Walk step keys; track the highest index whose substate is a non-empty object.
    let highestCompleted = -1;
    stepKeysInOrder.forEach((key, i) => {
      const value = restored[key];
      if (value && typeof value === "object" && Object.keys(value).length > 0) {
        highestCompleted = i;
      }
    });
    initialStepIndex = Math.min(Math.max(highestCompleted, 0), 5);
  }

  return { ...restored, _initialStepIndex: initialStepIndex } as Partial<JoinState>;
}

/**
 * Complete signup — runs server action to provision workspace shell, then redirects.
 * Maps wizard state keys (account, business, ...) to server action keys (step1, step2, ...).
 */
async function onComplete(state: JoinState): Promise<void> {
  // Persist final state to localStorage as backup (envelope with TTL + schema version)
  saveJoinState(state);

  const setupData = {
    step1: {
      email: state.account.email ?? "",
      firstName: state.account.firstName ?? "",
      lastName: state.account.lastName ?? "",
      companyName: state.account.companyName ?? "",
      industry: state.account.industry ?? "",
      city: state.account.city,
      websiteUrl: state.account.websiteUrl ?? "",
    },
    step2: {
      street: state.business.street ?? "",
      postalCode: state.business.postalCode ?? "",
      city: state.business.city ?? "",
      orgNumber: (state.business.orgNumber ?? "").replace(/\s/g, ""),
    },
    step3: {
      aboutUs: state.about.aboutUs,
      ourHistory: state.about.ourHistory,
      ourConcept: state.about.ourConcept,
    },
    step4: {
      openingHours: state.hours.openingHours ?? [],
      phone: state.hours.phone ?? "",
      instagram: state.hours.instagram,
      facebook: state.hours.facebook,
    },
    step5: {
      restaurantType: state.menu.restaurantType,
      cuisineTypes: state.menu.cuisineTypes,
      priceCategory: state.menu.priceCategory,
      menuDescription: state.menu.menuDescription,
    },
    step6: state.createAccount ?? {},
    intelligence: state.intelligence,
  };

  // Force a client-side session sync so the cookies the Server Action sees
  // are the freshest version. getSession() triggers a refresh when the
  // access token has expired; getUser() then forces a verified roundtrip
  // against the auth server so any pending rotation is committed to
  // cookies BEFORE the RSC POST serializes its Cookie header. Without
  // this two-step the server would itself try to refresh and race the
  // client → `refresh_token_already_used` (prod 500 on 2026-05-18).
  try {
    const supabase = createClient();
    await supabase.auth.getSession();
    await supabase.auth.getUser();
  } catch {
    // best-effort — server still throws "Not authenticated" if cookies
    // are unrecoverable, surfaced to the user as a retry prompt.
  }

  const result = await completeSignup(setupData);

  if (!result.ok) {
    if (result.reason === "session_expired") {
      // Emit telemetry before redirect (ADR-0112: same-commit registration)
      try {
        const { emit } = await import("@smartout/telemetry");
        await emit({
          event: "join.session_expired_at_submit",
          workspace_id: null,
          actor_id: null,
          properties: { data: { wizard_step: 6 } },
        });
      } catch {
        // best-effort — never block the redirect
      }
      // Redirect to login with return_to so the user can re-auth and resume
      window.location.replace("/login?return_to=/join&reason=expired");
      return;
    }
    // system_error — surface to user; wizard shell will catch this throw
    throw new Error(result.message ?? "Noe gikk galt. Prøv igjen.");
  }

  // Clear localStorage after successful signup
  clearJoinState();

  // Redirect to onboarding confirmation wizard
  const redirectPath = buildPostSignupRedirectPath(result.workspaceId);
  window.location.href = redirectPath;
}

export const joinWizard: WizardDefinition<JoinState> = {
  id: "join",
  theme: "warm",

  metadata: {
    titleKey: "wizard.title",
    descriptionKey: "wizard.description",
    i18nNamespace: "join",
  },

  brandPanel: {
    logoSrc: "/smartout-logo.png",
    position: "right",
    messages: {
      account: {
        heading: "Fortell oss\nom bedriften din.",
        sub: "Vi bruker dette til å sette opp alt for deg.",
      },
      business: {
        heading: "Vi fyller ut\nså mye vi kan.",
        sub: "Sjekk at informasjonen stemmer — du kan endre alt.",
      },
      about: {
        heading: "Gi bedriften\ndin en stemme.",
        sub: "AI hjelper deg å skrive — du bestemmer tonen.",
      },
      hours: {
        heading: "Når er dere\nåpne?",
        sub: "Åpningstider hjelper oss planlegge drift og bemanning.",
      },
      menu: {
        heading: "Del menyen\ndin.",
        sub: "Valgfritt — men det gir smartere opplæring.",
      },
      summary: {
        heading: "Nesten\nferdig.",
        sub: "Sjekk at alt stemmer — så setter vi i gang.",
      },
    },
  },

  initialState: defaultJoinState,
  loadState,
  onComplete,

  steps: [
    {
      id: "account",
      labelKey: "steps.account",
      iconName: "mail",
      component: Step1Account,
      validation: step1Schema,
      validationKey: "account",
    },
    {
      id: "business",
      labelKey: "steps.business",
      iconName: "building-2",
      component: Step2Business,
      validation: step2Schema,
      validationKey: "business",
    },
    {
      id: "about",
      labelKey: "steps.about",
      iconName: "file-text",
      component: Step3About,
      validation: step3Schema,
      validationKey: "about",
      skippable: true,
    },
    {
      id: "hours",
      labelKey: "steps.hours",
      iconName: "clock",
      component: Step4Hours,
      validation: step4Schema,
      validationKey: "hours",
    },
    {
      id: "menu",
      labelKey: "steps.menu",
      iconName: "utensils-crossed",
      component: Step5Menu,
      validation: step5Schema,
      validationKey: "menu",
      skippable: true,
    },
    {
      id: "summary",
      labelKey: "steps.summary",
      iconName: "check-circle",
      component: Step6Summary,
      // No hideNavBar — the standard "Fullfør" nav button triggers onComplete
    },
  ],
};
