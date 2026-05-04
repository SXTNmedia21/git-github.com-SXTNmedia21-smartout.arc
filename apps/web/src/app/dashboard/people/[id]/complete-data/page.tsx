"use client";

/**
 * /dashboard/people/[id]/complete-data — Admin PII bypass form.
 *
 * Allows an admin to fill in missing employee PII (personnummer, bank, address)
 * on behalf of the employee. Uses the admin_submit_employee_pii RPC which is
 * a SECURITY DEFINER function (ADR-0081). The employee is notified when data
 * is submitted on their behalf.
 *
 * ADR-0077: PII handling. ADR-0078: channel restriction.
 */

import { useState, useContext, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Input, Label } from "@smartout/ui";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

// ---------------------------------------------------------------------------
// Field groups and their input fields
// ---------------------------------------------------------------------------

type FieldGroup = "identity" | "banking" | "address";

const FIELD_GROUPS: Record<FieldGroup, { label: string; icon: string }> = {
  identity: { label: "Identitet", icon: "id" },
  banking: { label: "Bank", icon: "bank" },
  address: { label: "Adresse", icon: "address" },
};

type FormValues = {
  personal_number: string;
  bank_account: string;
  address_line_1: string;
  postal_code: string;
  city: string;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CompleteDataPage() {
  const { id: profileId } = useParams<{ id: string }>();
  const router = useRouter();
  const { workspaceData } = useContext(DashboardContext);

  const [selectedGroup, setSelectedGroup] = useState<FieldGroup>("identity");
  const [values, setValues] = useState<FormValues>({
    personal_number: "",
    bank_account: "",
    address_line_1: "",
    postal_code: "",
    city: "",
  });
  const [reason, setReason] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actorId, setActorId] = useState<string | null>(null);

  const workspaceId = workspaceData?.workspace_id;

  // Resolve actor_id from auth — needed for telemetry emit
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setActorId(data.user.id);
    });
  }, []);

  // Build the values payload based on selected group
  function getGroupValues(): Record<string, string> {
    switch (selectedGroup) {
      case "identity":
        return { personal_number: values.personal_number };
      case "banking":
        return { bank_account: values.bank_account };
      case "address":
        return {
          address_line_1: values.address_line_1,
          postal_code: values.postal_code,
          city: values.city,
        };
    }
  }

  // Validate that at least one field in the group is filled
  function isGroupValid(): boolean {
    const groupValues = getGroupValues();
    return Object.values(groupValues).some((v) => v.trim().length > 0);
  }

  const canSubmit = reason.trim().length >= 10 && isGroupValid() && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !workspaceId || !actorId) return;

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("admin_submit_employee_pii", {
        p_profile_id: profileId,
        p_field_group: selectedGroup,
        p_values: getGroupValues(),
        p_reason: reason.trim(),
      });

      if (error) {
        toast.error(`Feil: ${error.message}`);
        return;
      }

      await emit({
        event: "contract intake admin bypass",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty(actorId, "actor_id"),
        properties: {
          entity: { entity_type: "profile", entity_id: profileId },
          data: { field_group: selectedGroup, reason: reason.trim() },
        },
      });

      toast.success("Data lagret. Ansatt blir varslet.");
      router.push("/dashboard/people");
    } catch {
      toast.error("Noe gikk galt. Proev igjen.");
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="text-primary h-6 w-6" />
        <h1 className="text-foreground text-xl font-bold tracking-tight">
          Fyll inn data for ansatt
        </h1>
      </div>

      {/* Warning */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Ansatten vil bli varslet om at data er fylt ut paa deres vegne. Bruk denne funksjonen kun
          naar ansatten ikke kan gjennomfoere det selv.
        </p>
      </div>

      {/* Field group selector */}
      <div>
        <p className="text-muted-foreground mb-2 text-sm font-medium">Velg feltgruppe</p>
        <div className="flex gap-2">
          {(Object.keys(FIELD_GROUPS) as FieldGroup[]).map((group) => (
            <Button
              key={group}
              variant={selectedGroup === group ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedGroup(group)}
            >
              {FIELD_GROUPS[group].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Fields per group */}
      <div className="space-y-4 rounded-lg border p-4">
        {selectedGroup === "identity" && (
          <div className="space-y-2">
            <Label htmlFor="personal_number">Personnummer</Label>
            <Input
              id="personal_number"
              placeholder="11 siffer"
              value={values.personal_number}
              onChange={(e) => setValues((v) => ({ ...v, personal_number: e.target.value }))}
            />
          </div>
        )}

        {selectedGroup === "banking" && (
          <div className="space-y-2">
            <Label htmlFor="bank_account">Kontonummer</Label>
            <Input
              id="bank_account"
              placeholder="11 siffer"
              value={values.bank_account}
              onChange={(e) => setValues((v) => ({ ...v, bank_account: e.target.value }))}
            />
          </div>
        )}

        {selectedGroup === "address" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="address_line_1">Adresse</Label>
              <Input
                id="address_line_1"
                placeholder="Gateadresse"
                value={values.address_line_1}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    address_line_1: e.target.value,
                  }))
                }
              />
            </div>
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
          </>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Begrunnelse (minst 10 tegn)</Label>
        <Textarea
          id="reason"
          placeholder="Forklar hvorfor du fyller inn data paa vegne av ansatten..."
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          rows={3}
        />
        {reason.length > 0 && reason.length < 10 && (
          <p className="text-xs text-red-600">Minst 10 tegn ({reason.length}/10)</p>
        )}
      </div>

      {/* Submit / Confirm */}
      {!showConfirm ? (
        <Button onClick={() => setShowConfirm(true)} disabled={!canSubmit} className="w-full">
          Send inn data
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800">
            Er du sikker? Ansatten vil bli varslet, og handlingen logges.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} variant="destructive" size="sm">
              {submitting ? "Lagrer..." : "Bekreft og send"}
            </Button>
            <Button onClick={() => setShowConfirm(false)} variant="outline" size="sm">
              Avbryt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
