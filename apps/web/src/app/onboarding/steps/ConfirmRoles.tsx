"use client";

/**
 * ConfirmRoles — leadership and organizational roles.
 *
 * Only selected roles are visible. Unselected roles appear in a
 * popover when clicking "+ Legg til flere roller". Required roles
 * (verneombud, brannvernleder) cannot be removed.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { Plus, X, Sparkles, Shield } from "lucide-react";
import type { WizardStepProps } from "@smartout/ui";
import type { OnboardingConfirmState } from "../types-v2";
import type { RoleOption } from "../types";

const DEFAULT_ROLES: RoleOption[] = [
  {
    id: "role-daglig-leder",
    name: "Daglig leder",
    description: "Overordnet ansvar for daglig drift",
    selected: true,
    required: false,
  },
  {
    id: "role-restaurantsjef",
    name: "Restaurantsjef",
    description: "Leder for restaurant og sal",
    selected: true,
    required: false,
  },
  {
    id: "role-kjokkensjef",
    name: "Kjøkkensjef",
    description: "Leder for kjøkken og matlaging",
    selected: true,
    required: false,
  },
  {
    id: "role-barsjef",
    name: "Barsjef",
    description: "Ansvarlig for bar og drikke",
    selected: false,
    required: false,
  },
  {
    id: "role-skiftleder",
    name: "Skiftleder",
    description: "Leder for enkeltvakter",
    selected: false,
    required: false,
  },
  {
    id: "role-verneombud",
    name: "Verneombud",
    description: "Lovpålagt HMS-rolle — påkrevd ved 10+ ansatte",
    selected: true,
    required: true,
  },
  {
    id: "role-brannvernleder",
    name: "Brannvernleder",
    description: "Ansvarlig for brannsikkerhet og evakuering",
    selected: true,
    required: true,
  },
  {
    id: "role-tillitsvalgt",
    name: "Tillitsvalgt",
    description: "Representerer de ansatte overfor ledelsen",
    selected: false,
    required: false,
  },
  {
    id: "role-vaktmester",
    name: "Vaktmester",
    description: "Ansvarlig for bygning og vedlikehold",
    selected: false,
    required: false,
  },
  {
    id: "role-fagansvarlig",
    name: "Fagansvarlig",
    description: "Ansvarlig for faglig utvikling og opplæring",
    selected: false,
    required: false,
  },
];

export function ConfirmRoles({ state, updateState }: WizardStepProps<OnboardingConfirmState>) {
  const [showPopover, setShowPopover] = useState(false);
  const [customInput, setCustomInput] = useState(false);
  const [customName, setCustomName] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize roles on first render if empty
  const needsInit = state.roles.length === 0;
  useEffect(() => {
    if (needsInit) {
      updateState({ roles: DEFAULT_ROLES });
    }
  }, [needsInit, updateState]);

  const roles = useMemo(
    () => (state.roles.length > 0 ? state.roles : DEFAULT_ROLES),
    [state.roles],
  );

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
        setCustomInput(false);
        setCustomName("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  const selectedRoles = roles.filter((r) => r.selected);
  const unselectedRoles = roles.filter((r) => !r.selected);

  function removeRole(id: string) {
    const role = roles.find((r) => r.id === id);
    if (role?.required) return;
    updateState({
      roles: roles.map((r) => (r.id === id ? { ...r, selected: false } : r)),
    });
  }

  function addRole(id: string) {
    updateState({
      roles: roles.map((r) => (r.id === id ? { ...r, selected: true } : r)),
    });
    setShowPopover(false);
  }

  function addCustomRole() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    updateState({
      roles: [
        ...roles,
        {
          id: `role-custom-${Date.now()}`,
          name: trimmed,
          description: "",
          selected: true,
          required: false,
        },
      ],
    });
    setCustomName("");
    setCustomInput(false);
    setShowPopover(false);
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6">
      <div>
        <h2 className="font-heading text-foreground text-2xl font-bold">Roller</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Hvilke lederskap- og ansvarsroller har dere? Noen er lovpålagt.
        </p>
        <p className="text-brand-orange mt-2 flex items-center gap-1.5 text-xs">
          <Sparkles className="h-3 w-3" />
          {selectedRoles.length} roller valgt
        </p>
      </div>

      <div className="space-y-2">
        {selectedRoles.map((role) => (
          <div
            key={role.id}
            className="text-foreground flex w-full items-center justify-between rounded-lg border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-5 shrink-0 items-center justify-center rounded border border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/20 text-xs text-[var(--brand-orange)]">
                &#10003;
              </span>
              <span>
                <span className="text-sm font-medium">{role.name}</span>
                {role.description && (
                  <span className="text-muted-foreground ml-2 text-xs">{role.description}</span>
                )}
              </span>
            </span>

            {role.required ? (
              <span className="flex items-center gap-1 text-[10px] text-[var(--brand-orange)]">
                <Shield className="size-3" />
                Påkrevd
              </span>
            ) : (
              <button
                type="button"
                onClick={() => removeRole(role.id)}
                className="text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}

        {/* Add more roles */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setShowPopover(!showPopover)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-1 text-xs transition-colors"
          >
            <Plus className="size-3.5" />
            Legg til flere roller
          </button>

          {showPopover && (
            <div className="border-border bg-card absolute left-0 z-20 mt-1 w-64 rounded-lg border py-1 shadow-lg">
              {unselectedRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => addRole(role.id)}
                  className="text-foreground flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--brand-orange)]/10 hover:text-[var(--brand-orange)]"
                >
                  <span className="text-xs font-medium">{role.name}</span>
                  {role.description && (
                    <span className="text-muted-foreground text-[10px]">{role.description}</span>
                  )}
                </button>
              ))}

              {unselectedRoles.length > 0 && <div className="border-border my-1 border-t" />}

              {customInput ? (
                <div className="flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addCustomRole();
                      if (e.key === "Escape") {
                        setCustomInput(false);
                        setCustomName("");
                      }
                    }}
                    placeholder="Rollenavn"
                    className="border-border bg-background text-foreground placeholder:text-muted-foreground flex-1 rounded border px-2 py-1 text-xs focus-visible:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addCustomRole}
                    className="px-1 text-xs font-medium text-[var(--brand-orange)]"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomInput(true)}
                  className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs"
                >
                  <Plus className="size-3" />
                  Egendefinert...
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
