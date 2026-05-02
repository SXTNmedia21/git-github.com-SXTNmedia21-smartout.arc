// MembersSection.tsx — company member roster
//
// Shows company_member rows with user_identity joined (name, email, role).
// members === null means RLS denied (orders_only scope) — renders a
// gray "Ikke tilgang" placeholder and emits kartotek section_failed.
//
// Server Component. No "use client".

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { emit, nonEmpty } from "@/lib/telemetry";
import type { KartotekMemberRow } from "@smartout/billing/server";

type Props = {
  members: KartotekMemberRow[] | null;
  hasPartialAccess: boolean;
  workspaceId: string;
  userId: string;
};

function roleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Eier";
    case "admin":
      return "Admin";
    case "manager":
      return "Leder";
    case "employee":
      return "Ansatt";
    default:
      return role;
  }
}

function fullName(
  identity: { first_name: string; last_name: string; email: string } | null,
): string {
  if (!identity) return "—";
  const name = [identity.first_name, identity.last_name].filter(Boolean).join(" ");
  return name || identity.email;
}

export async function MembersSection({ members, hasPartialAccess, workspaceId, userId }: Props) {
  // RLS denied — emit section_failed and render placeholder.
  if (members === null && hasPartialAccess) {
    await emit({
      event: "kartotek section_failed",
      actor_id: nonEmpty(userId, "actor_id"),
      workspace_id: null,
      properties: {
        entity: { entity_type: "workspace", entity_id: workspaceId },
        data: { workspace_id: workspaceId, section: "members", reason: "rls_denied" },
      },
    });

    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medlemmer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Ikke tilgang — denne seksjonen krever full kartotek-tilgang
          </p>
        </CardContent>
      </Card>
    );
  }

  const list = members ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Medlemmer{" "}
          {list.length > 0 && (
            <span className="text-muted-foreground text-xs font-normal">({list.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="p-6">
            <p className="text-muted-foreground text-sm">Ingen medlemmer registrert</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Navn</TableHead>
                <TableHead>E-post</TableHead>
                <TableHead>Rolle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((member) => (
                <TableRow key={member.user_id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{fullName(member.user_identity)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {member.user_identity?.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {roleLabel(member.role)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
