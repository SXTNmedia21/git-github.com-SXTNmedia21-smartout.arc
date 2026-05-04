"use client";

/**
 * /dashboard/my-profile/complete — Employee self-service data completion.
 *
 * UI lens for contract_data_intake: the employee fills in missing PII
 * (identity group: personal_number, address, postal_code, city) needed
 * for their employment contract. Uses the submit_own_pii RPC — employee
 * submits their own data without requiring admin/owner role.
 *
 * ADR-0077: PII handling. ADR-0078: channel restriction (chat only — voice forbidden).
 */

import { useState, useContext, useEffect } from "react";
import { User, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { TaskRunner } from "@smartout/ui";
import { Input, Label } from "@smartout/ui";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

type FormValues = {
  personal_number: string;
  address: string;
  postal_code: string;
  city: string;
};

const EMPTY_FORM: FormValues = {
  personal_number: "",
  address: "",
  postal_code: "",
  city: "",
};

export default function CompleteProfilePage() {
  const { workspaceData, profileId } = useContext(DashboardContext);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [actorId, setActorId] = useState<string | null>(null);

  const workspaceId = workspaceData?.workspace_id;

  // Resolve auth user id for telemetry
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setActorId(data.user.id);
    });
  }, []);

  const hasAnyValue = Object.values(values).some((v) => v.trim().length > 0);
  const canSubmit = hasAnyValue && !submitting && !!profileId && !!workspaceId;

  async function handleSubmit() {
    if (!canSubmit || !actorId) return;

    setSubmitting(true);
    try {
      const supabase = createClient();

      // Submit identity group (personal_number) if provided
      if (values.personal_number.trim()) {
        const { error: identityError } = await supabase.rpc("submit_own_pii", {
          p_workspace_id: workspaceId!,
          p_field_group: "identity",
          p_values: { personal_number: values.personal_number.trim() },
        });

        if (identityError) {
          toast.error(`Feil: ${identityError.message}`);
          return;
        }
      }

      // Submit address group if any address field is provided
      const addressValues: Record<string, string> = {};
      if (values.address.trim()) addressValues.address_line_1 = values.address.trim();
      if (values.postal_code.trim()) addressValues.postal_code = values.postal_code.trim();
      if (values.city.trim()) addressValues.city = values.city.trim();

      if (Object.keys(addressValues).length > 0) {
        const { error: addressError } = await supabase.rpc("submit_own_pii", {
          p_workspace_id: workspaceId!,
          p_field_group: "address",
          p_values: addressValues,
        });

        if (addressError) {
          toast.error(`Feil: ${addressError.message}`);
          return;
        }
      }

      await emit({
        event: "contract intake field submitted",
        workspace_id: nonEmpty(workspaceId!, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          entity: { entity_type: "profile", entity_id: profileId! },
          data: { group: "self_service" },
        },
      });

      setSubmitted(true);
      toast.success("Data sendt inn!");
    } catch {
      toast.error("Noe gikk galt. Proev igjen.");
    } finally {
      setSubmitting(false);
    }
  }

  // Success state after submit
  if (submitted) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <CheckCircle className="text-primary mx-auto mb-4 h-12 w-12" />
        <h2 className="text-foreground text-lg font-semibold">Takk!</h2>
        <p className="text-muted-foreground text-sm">
          Informasjonen er lagret. Du kan lukke denne siden.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <TaskRunner
        icon={User}
        title="Fullfoor profilen din"
        description="Vi trenger litt informasjon for aa kunne lage arbeidskontrakten din. Fyll inn det du kan."
        ctaLabel="Send inn"
        onCtaClick={handleSubmit}
        isLoading={submitting}
        isDisabled={!canSubmit}
      >
        <div className="space-y-4">
          {/* Personal number */}
          <div className="space-y-2">
            <Label htmlFor="personal_number">Personnummer</Label>
            <Input
              id="personal_number"
              placeholder="11 siffer"
              value={values.personal_number}
              onChange={(e) => setValues((v) => ({ ...v, personal_number: e.target.value }))}
            />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input
              id="address"
              placeholder="Gateadresse"
              value={values.address}
              onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            />
          </div>

          {/* Postal code + City */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Postnummer</Label>
              <Input
                id="postal_code"
                placeholder="0000"
                value={values.postal_code}
                onChange={(e) => setValues((v) => ({ ...v, postal_code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Poststed</Label>
              <Input
                id="city"
                placeholder="By"
                value={values.city}
                onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </TaskRunner>
    </div>
  );
}
