/**
 * Employee Onboarding Wizard — mobile route.
 *
 * Mounted by the (app)/_layout redirect when profile.is_welcome_complete === false.
 * Delegates all step rendering to WizardShell; BFF writes via dismissOnboarding().
 *
 * WizardDefinition shape per packages/ui/src/wizard/types.ts:
 *   id, theme, steps, metadata, initialState, loadState?, onComplete?
 */

import * as React from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";
import { WizardShell } from "@/components/ui/WizardShell";
import { HeroStep } from "@/components/welcome-wizard/_steps/HeroStep";
import { ContactStep } from "@/components/welcome-wizard/_steps/ContactStep";
import { AddressStep } from "@/components/welcome-wizard/_steps/AddressStep";
import { PersonalNumberStep } from "@/components/welcome-wizard/_steps/PersonalNumberStep";
import { AvailabilityStep } from "@/components/welcome-wizard/_steps/AvailabilityStep";
import { ConsentStep } from "@/components/welcome-wizard/_steps/ConsentStep";
import { OptionalStep } from "@/components/welcome-wizard/_steps/OptionalStep";
import { DoneStep } from "@/components/welcome-wizard/_steps/DoneStep";
import { dismissOnboarding } from "@/lib/onboarding-bff";
import type { WizardDefinition } from "@smartout/ui/wizard/state";

// Minimal state — WizardShell manages step-level form state internally via BFF.
type OnboardingState = { initialised: boolean };

export default function OnboardingScreen() {
  const router = useRouter();

  const definition: WizardDefinition<OnboardingState> = React.useMemo(
    () => ({
      id: "employee-onboarding",
      theme: "warm",
      metadata: {
        titleKey: "onboarding.title",
        descriptionKey: "onboarding.description",
        i18nNamespace: "onboarding",
      },
      steps: [
        {
          id: "hero",
          labelKey: "Velkommen",
          component: HeroStep as never,
        },
        {
          id: "contact",
          labelKey: "Kontakt",
          component: ContactStep as never,
        },
        {
          id: "address",
          labelKey: "Adresse",
          component: AddressStep as never,
        },
        {
          id: "personnr",
          labelKey: "Personnummer",
          component: PersonalNumberStep as never,
        },
        {
          id: "avail",
          labelKey: "Tilgjengelighet",
          component: AvailabilityStep as never,
        },
        {
          id: "consent",
          labelKey: "Samtykke",
          component: ConsentStep as never,
        },
        {
          id: "optional",
          labelKey: "Valgfritt",
          component: OptionalStep as never,
          skippable: true,
        },
        {
          id: "done",
          labelKey: "Ferdig",
          component: DoneStep as never,
        },
      ],
      initialState: { initialised: true },
      loadState: async () => ({ initialised: true }),
      onComplete: async () => {
        router.replace("/(app)/(home)");
      },
    }),
    [router],
  );

  const onDismiss = React.useCallback(async () => {
    try {
      await dismissOnboarding();
      router.replace("/(app)/(home)");
    } catch (e) {
      Alert.alert("Kunne ikke lukke", e instanceof Error ? e.message : "Ukjent feil");
    }
  }, [router]);

  return <WizardShell definition={definition} departmentName="Onboarding" onDismiss={onDismiss} />;
}
