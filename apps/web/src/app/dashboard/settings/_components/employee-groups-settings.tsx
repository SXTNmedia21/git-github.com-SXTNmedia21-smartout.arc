"use client";

// Card-per-group layout with collapsible member tables.
// Each group card expands in-place to show its members — no page navigation needed.
// The Sheet pattern from salary-codes-settings is reused for both group editing
// and adding/editing individual members.
//
// UI Events:
// - action: openCreateGroup() — "Legg til gruppe" header button
// - action: openEditGroup(group) — pencil icon on group card header
// - action: toggleExpanded(groupId) — click anywhere on group card header area
// - action: openAddMember(groupId) — "Legg til ansatt" inside expanded card
// - action: openEditMember(member) — click member row
// - action: useDeleteEmployeeGroup().mutate({ id, name }) — delete button in group Sheet footer
// - action: useRemoveGroupMember().mutate({ id, groupId, membProfileId }) — remove in member Sheet footer
// - color-regime: is_active based (active = default, inactive = muted badge)
// - color-regime: hourly_rate null = "Gruppestandard" (muted), set = formatted kr amount

import { useState, useEffect, useContext } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Users,
  FileSignature,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { Button, Badge, Card, Skeleton, Label, Input } from "@smartout/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useEmployeeGroups,
  useEmployeeGroupMembers,
  useWorkspaceProfiles,
  useCreateEmployeeGroup,
  useUpdateEmployeeGroup,
  useDeleteEmployeeGroup,
  useAddGroupMember,
  useUpdateGroupMember,
  useRemoveGroupMember,
  employeeGroupSchema,
  employeeGroupMemberSchema,
  WAGE_TYPES,
  type EmployeeGroupInput,
  type EmployeeGroupMemberInput,
  type EmployeeGroupRow,
  type EmployeeGroupMemberWithProfile,
  type WageType,
} from "../_hooks/use-employee-groups";
import { TemplateBindingsPanel } from "./template-bindings-settings";

// ─── Constants ────────────────────────────────────────────────────────────────

const WAGE_TYPE_LABELS: Record<WageType, string> = {
  hourly: "Timebetalt",
  per_shift: "Per vakt",
  monthly: "Månedslønn",
};

function formatRate(rate: number): string {
  return `kr ${rate.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}/t`;
}

function formatDefaultRate(rate: number): string {
  return `kr ${rate.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}/t`;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function GroupSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="h-7 w-7 rounded" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Group Sheet ──────────────────────────────────────────────────────────────

type GroupSheetMode = "create" | "edit";

type GroupSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: GroupSheetMode;
  initialValues?: EmployeeGroupRow;
};

function GroupSheet({ open, onClose, mode, initialValues }: GroupSheetProps) {
  const createGroup = useCreateEmployeeGroup();
  const updateGroup = useUpdateEmployeeGroup();
  const deleteGroup = useDeleteEmployeeGroup();

  const isEdit = mode === "edit";
  const isPending = createGroup.isPending || updateGroup.isPending;

  const form = useForm<EmployeeGroupInput>({
    resolver: zodResolver(employeeGroupSchema),
    defaultValues: {
      name: "",
      description: null,
      default_hourly_rate: 0,
      salary_code: null,
      department_id: null,
      is_active: true,
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && initialValues) {
        form.reset({
          name: initialValues.name,
          description: initialValues.description,
          default_hourly_rate: initialValues.default_hourly_rate,
          salary_code: initialValues.salary_code,
          department_id: initialValues.department_id,
          is_active: initialValues.is_active,
          sort_order: initialValues.sort_order,
        });
      } else {
        form.reset({
          name: "",
          description: null,
          default_hourly_rate: 0,
          salary_code: null,
          department_id: null,
          is_active: true,
          sort_order: 0,
        });
      }
    }
  }, [open, isEdit, initialValues, form]);

  function onSubmit(values: EmployeeGroupInput) {
    if (isEdit && initialValues) {
      updateGroup.mutate({ id: initialValues.id, values }, { onSuccess: onClose });
    } else {
      createGroup.mutate(values, { onSuccess: onClose });
    }
  }

  function handleDelete() {
    if (!initialValues) return;
    if (
      !window.confirm(
        `Er du sikker på at du vil slette lønnsgruppen "${initialValues.name}"? Alle medlemmer vil miste gruppeknytningen. Dette kan ikke angres.`,
      )
    ) {
      return;
    }
    deleteGroup.mutate({ id: initialValues.id, name: initialValues.name }, { onSuccess: onClose });
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger lønnsgruppe" : "Ny lønnsgruppe"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater detaljene for denne lønnsgruppen."
              : "Opprett en lønnsgruppe for å samle ansatte med samme lønnsbetingelser."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="employee-group-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-4 overflow-y-auto py-4"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="eg-name" className="text-sm font-medium">
              Navn
            </Label>
            <Input id="eg-name" placeholder="f.eks. Deltidsansatte" {...form.register("name")} />
            {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="eg-description" className="text-sm font-medium">
              Beskrivelse
            </Label>
            <Textarea
              id="eg-description"
              placeholder="Valgfri beskrivelse..."
              rows={2}
              {...form.register("description")}
            />
          </div>

          {/* Default hourly rate */}
          <div className="space-y-1.5">
            <Label htmlFor="eg-rate" className="text-sm font-medium">
              Standard timesats (kr)
            </Label>
            <Input
              id="eg-rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...form.register("default_hourly_rate")}
            />
            {errors.default_hourly_rate && (
              <p className="text-destructive text-xs">{errors.default_hourly_rate.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Brukes for ansatte uten individuell timesats.
            </p>
          </div>

          {/* Salary code */}
          <div className="space-y-1.5">
            <Label htmlFor="eg-salary-code" className="text-sm font-medium">
              Lønnskode
            </Label>
            <Input
              id="eg-salary-code"
              placeholder="f.eks. 100"
              className="font-mono"
              {...form.register("salary_code")}
            />
          </div>

          {/* Sort order */}
          <div className="space-y-1.5">
            <Label htmlFor="eg-sort-order" className="text-sm font-medium">
              Sorteringsrekkefølge
            </Label>
            <Input
              id="eg-sort-order"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              {...form.register("sort_order")}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="eg-active" className="text-sm font-medium">
                Aktiv
              </Label>
              <p className="text-muted-foreground text-xs">
                Inaktive grupper er skjult fra valglister.
              </p>
            </div>
            <Switch
              id="eg-active"
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v, { shouldDirty: true })}
            />
          </div>

          {/* Contract template management — link to /dashboard/people/contracts?tab=maler.
              Per-category template bindings live in the expanded card view via
              TemplateBindingsPanel; this link is the entry point to author
              templates themselves. */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-start gap-3">
                <FileSignature className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Kontraktsmaler</p>
                  <p className="text-muted-foreground text-xs">
                    Lag og rediger maler som denne gruppen kan bruke.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/people/contracts?tab=maler"
                className="text-primary hover:bg-muted inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors"
              >
                Åpne
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </form>

        <SheetFooter className="flex-row gap-2 pt-4">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={deleteGroup.isPending}
              onClick={handleDelete}
              className="mr-auto"
            >
              {deleteGroup.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="ml-1.5">Slett</span>
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Avbryt
          </Button>
          <Button type="submit" form="employee-group-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Opprett gruppe"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Member Sheet ─────────────────────────────────────────────────────────────

type MemberSheetMode = "add" | "edit";

type MemberSheetProps = {
  open: boolean;
  onClose: () => void;
  mode: MemberSheetMode;
  groupId: string;
  initialValues?: EmployeeGroupMemberWithProfile;
};

function MemberSheet({ open, onClose, mode, groupId, initialValues }: MemberSheetProps) {
  const addMember = useAddGroupMember();
  const updateMember = useUpdateGroupMember();
  const removeMember = useRemoveGroupMember();
  const { data: profiles = [] } = useWorkspaceProfiles();

  const isEdit = mode === "edit";
  const isPending = addMember.isPending || updateMember.isPending;

  const today = new Date().toISOString().split("T")[0]!;

  const form = useForm<EmployeeGroupMemberInput>({
    resolver: zodResolver(employeeGroupMemberSchema),
    defaultValues: {
      profile_id: "",
      employee_group_id: groupId,
      hourly_rate: null,
      valid_from: today,
      valid_until: null,
      wage_type: "hourly",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEdit && initialValues) {
        form.reset({
          profile_id: initialValues.profile_id,
          employee_group_id: initialValues.employee_group_id,
          hourly_rate: initialValues.hourly_rate,
          valid_from: initialValues.valid_from,
          valid_until: initialValues.valid_until,
          wage_type: initialValues.wage_type as WageType,
        });
      } else {
        form.reset({
          profile_id: "",
          employee_group_id: groupId,
          hourly_rate: null,
          valid_from: today,
          valid_until: null,
          wage_type: "hourly",
        });
      }
    }
  }, [open, isEdit, initialValues, groupId, today, form]);

  function onSubmit(values: EmployeeGroupMemberInput) {
    if (isEdit && initialValues) {
      updateMember.mutate({ id: initialValues.id, values }, { onSuccess: onClose });
    } else {
      addMember.mutate(values, { onSuccess: onClose });
    }
  }

  function handleRemove() {
    if (!initialValues) return;
    if (!window.confirm("Fjerne denne ansatte fra gruppen?")) return;
    removeMember.mutate(
      {
        id: initialValues.id,
        groupId: initialValues.employee_group_id,
        membProfileId: initialValues.profile_id,
      },
      { onSuccess: onClose },
    );
  }

  const errors = form.formState.errors;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Rediger lønnsinfo" : "Legg til ansatt"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Oppdater lønnsbetingelsene for denne ansatte i gruppen."
              : "Legg en ansatt til i lønnsgruppen."}
          </SheetDescription>
        </SheetHeader>

        <form
          id="member-form"
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex-1 space-y-4 overflow-y-auto py-4"
        >
          {/* Profile selector — disabled when editing (profile cannot be changed) */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-profile" className="text-sm font-medium">
              Ansatt
            </Label>
            {isEdit ? (
              <p className="text-sm font-medium">{initialValues?.profile_display_name}</p>
            ) : (
              <Select
                value={form.watch("profile_id")}
                onValueChange={(v) =>
                  form.setValue("profile_id", v, { shouldValidate: true, shouldDirty: true })
                }
              >
                <SelectTrigger id="mem-profile" className="w-full">
                  <SelectValue placeholder="Velg ansatt..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.profile_id} value={p.profile_id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.profile_id && (
              <p className="text-destructive text-xs">{errors.profile_id.message}</p>
            )}
          </div>

          {/* Wage type */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-wage-type" className="text-sm font-medium">
              Lønnstype
            </Label>
            <Select
              value={form.watch("wage_type")}
              onValueChange={(v) =>
                form.setValue("wage_type", v as WageType, { shouldDirty: true })
              }
            >
              <SelectTrigger id="mem-wage-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WAGE_TYPES.map((wt) => (
                  <SelectItem key={wt} value={wt}>
                    {WAGE_TYPE_LABELS[wt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Individual hourly rate — null = use group default */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-rate" className="text-sm font-medium">
              Individuell timesats (kr)
            </Label>
            <Input
              id="mem-rate"
              type="number"
              step="0.01"
              min="0"
              placeholder="Tom = gruppestandard"
              value={form.watch("hourly_rate") ?? ""}
              onChange={(e) =>
                form.setValue(
                  "hourly_rate",
                  e.target.value === "" ? null : parseFloat(e.target.value),
                  { shouldDirty: true },
                )
              }
            />
            <p className="text-muted-foreground text-xs">
              La feltet stå tomt for å bruke gruppens standard timesats.
            </p>
          </div>

          {/* Valid from */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-valid-from" className="text-sm font-medium">
              Gyldig fra
            </Label>
            <Input id="mem-valid-from" type="date" {...form.register("valid_from")} />
            {errors.valid_from && (
              <p className="text-destructive text-xs">{errors.valid_from.message}</p>
            )}
          </div>

          {/* Valid until */}
          <div className="space-y-1.5">
            <Label htmlFor="mem-valid-until" className="text-sm font-medium">
              Gyldig til
            </Label>
            <Input
              id="mem-valid-until"
              type="date"
              value={form.watch("valid_until") ?? ""}
              onChange={(e) =>
                form.setValue("valid_until", e.target.value || null, { shouldDirty: true })
              }
            />
            <p className="text-muted-foreground text-xs">Tom = ingen sluttdato.</p>
          </div>
        </form>

        <SheetFooter className="flex-row gap-2 pt-4">
          {isEdit && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={removeMember.isPending}
              onClick={handleRemove}
              className="mr-auto"
            >
              {removeMember.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              <span className="ml-1.5">Fjern</span>
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Avbryt
          </Button>
          <Button type="submit" form="member-form" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Lagrer...
              </>
            ) : isEdit ? (
              "Lagre endringer"
            ) : (
              "Legg til"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Member table (rendered inside expanded group card) ───────────────────────

type MemberTableProps = {
  groupId: string;
  onAddMember: () => void;
  onEditMember: (member: EmployeeGroupMemberWithProfile) => void;
};

function MemberTable({ groupId, onAddMember, onEditMember }: MemberTableProps) {
  const { data: members = [], isLoading } = useEmployeeGroupMembers(groupId);

  if (isLoading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t">
      {members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-muted-foreground text-sm">Ingen ansatte i denne gruppen ennå.</p>
          <Button variant="outline" size="sm" onClick={onAddMember}>
            <Plus className="mr-1.5 h-4 w-4" />
            Legg til den første
          </Button>
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ansatt</TableHead>
                <TableHead className="w-36">Timesats</TableHead>
                <TableHead className="w-28">Lønnstype</TableHead>
                <TableHead className="w-28">Gyldig fra</TableHead>
                <TableHead className="w-28">Gyldig til</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() => onEditMember(member)}
                >
                  <TableCell className="text-sm font-medium">
                    {member.profile_display_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {member.hourly_rate === null ? (
                      <span className="text-muted-foreground text-xs italic">Gruppestandard</span>
                    ) : (
                      formatRate(member.hourly_rate)
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {WAGE_TYPE_LABELS[member.wage_type as WageType] ?? member.wage_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {member.valid_from}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {member.valid_until ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t p-3">
            <Button variant="outline" size="sm" onClick={onAddMember}>
              <Plus className="mr-1.5 h-4 w-4" />
              Legg til ansatt
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Single group card ────────────────────────────────────────────────────────

type GroupCardProps = {
  group: EmployeeGroupRow;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddMember: () => void;
  onEditMember: (member: EmployeeGroupMemberWithProfile) => void;
};

function GroupCard({
  group,
  isExpanded,
  onToggle,
  onEdit,
  onAddMember,
  onEditMember,
}: GroupCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className="overflow-hidden">
        {/* Card header — click to expand, pencil to edit */}
        <div className="flex items-center gap-3 p-4">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex flex-1 items-center gap-3 text-left"
              aria-expanded={isExpanded}
            >
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition-transform" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0 transition-transform" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{group.name}</span>
                  {!group.is_active && (
                    <Badge variant="secondary" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                </div>
                {group.description && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {group.description}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {formatDefaultRate(group.default_hourly_rate)}
                </span>
                <div className="flex items-center gap-1">
                  <Users className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-muted-foreground text-xs">{group.member_count ?? 0}</span>
                </div>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Edit button — stopPropagation so it doesn't toggle the card */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label={`Rediger ${group.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Expandable member area */}
        <CollapsibleContent>
          <MemberTable groupId={group.id} onAddMember={onAddMember} onEditMember={onEditMember} />
          <TemplateBindingsPanel groupId={group.id} />
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Sheet state union:
//   undefined            = no sheet open
//   { type: "group", row: null }  = create group
//   { type: "group", row: EmployeeGroupRow } = edit group
//   { type: "member", groupId, row: null } = add member
//   { type: "member", groupId, row: EmployeeGroupMemberWithProfile } = edit member

type SheetState =
  | undefined
  | { type: "group"; row: EmployeeGroupRow | null }
  | { type: "member"; groupId: string; row: EmployeeGroupMemberWithProfile | null };

export function EmployeeGroupsSettings() {
  const { data: groups = [], isLoading } = useEmployeeGroups();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sheetState, setSheetState] = useState<SheetState>(undefined);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openCreateGroup() {
    setSheetState({ type: "group", row: null });
  }

  function openEditGroup(group: EmployeeGroupRow) {
    setSheetState({ type: "group", row: group });
  }

  function openAddMember(groupId: string) {
    setSheetState({ type: "member", groupId, row: null });
  }

  function openEditMember(groupId: string, member: EmployeeGroupMemberWithProfile) {
    setSheetState({ type: "member", groupId, row: member });
  }

  function closeSheet() {
    setSheetState(undefined);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <GroupSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-foreground text-lg font-semibold">Lønnsgrupper</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Samle ansatte med felles lønnsbetingelser i grupper. Individuelle satser overstyrer
            gruppens standard.
          </p>
        </div>
        <Button size="sm" onClick={openCreateGroup}>
          <Plus className="mr-1.5 h-4 w-4" />
          Legg til gruppe
        </Button>
      </div>

      {/* Group list */}
      {groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">Ingen lønnsgrupper opprettet ennå.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={openCreateGroup}>
            <Plus className="mr-1.5 h-4 w-4" />
            Opprett den første
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              isExpanded={expandedIds.has(group.id)}
              onToggle={() => toggleExpanded(group.id)}
              onEdit={() => openEditGroup(group)}
              onAddMember={() => openAddMember(group.id)}
              onEditMember={(member) => openEditMember(group.id, member)}
            />
          ))}
        </div>
      )}

      {/* Group Sheet */}
      <GroupSheet
        open={sheetState?.type === "group"}
        onClose={closeSheet}
        mode={sheetState?.type === "group" && sheetState.row !== null ? "edit" : "create"}
        initialValues={
          sheetState?.type === "group" && sheetState.row !== null ? sheetState.row : undefined
        }
      />

      {/* Member Sheet */}
      {sheetState?.type === "member" && (
        <MemberSheet
          open={true}
          onClose={closeSheet}
          mode={sheetState.row !== null ? "edit" : "add"}
          groupId={sheetState.groupId}
          initialValues={sheetState.row ?? undefined}
        />
      )}
    </div>
  );
}
