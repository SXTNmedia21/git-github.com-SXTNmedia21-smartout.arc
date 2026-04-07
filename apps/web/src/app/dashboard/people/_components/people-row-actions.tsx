"use client";

import {
  MoreHorizontal,
  Copy,
  Shield,
  Building2,
  KeyRound,
  Send,
  Link,
  UserX,
  XCircle,
  RefreshCw,
  FileSignature,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Employee, Department, ProfileRole } from "./types";

type ConfirmAction =
  | { type: "deactivate"; profileId: string; name: string }
  | { type: "cancelInvite"; invitationId: string; name: string }
  | { type: "resetPassword"; email: string; name: string }
  | { type: "reactivate"; profileId: string; name: string };

type PeopleRowActionsProps = {
  employee: Employee;
  departments: Department[];
  currentUserRole: ProfileRole;
  onRoleChange: (profileId: string, newRole: string) => void;
  onDepartmentChange: (profileId: string, departmentId: string) => void;
  onConfirmAction: (action: ConfirmAction) => void;
  onResendInvite: (invitationId: string, email: string) => void;
  onSendContract?: (profileId: string) => void;
};

const ROLE_HIERARCHY: Record<ProfileRole, ProfileRole[]> = {
  owner: ["admin", "manager", "employee"],
  admin: ["manager", "employee"],
  manager: [],
  employee: [],
};

export type { ConfirmAction };

export function PeopleRowActions({
  employee,
  departments,
  currentUserRole,
  onRoleChange,
  onDepartmentChange,
  onConfirmAction,
  onResendInvite,
  onSendContract,
}: PeopleRowActionsProps) {
  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";
  const isInvited = employee.status === "invited";
  const isActionable = employee.status === "active" || employee.status === "trainee";
  const assignableRoles = ROLE_HIERARCHY[currentUserRole] ?? [];

  function copyEmail() {
    navigator.clipboard.writeText(employee.email);
    toast.success("Email copied to clipboard");
  }

  function copyInviteLink() {
    const webOrigin = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "";
    navigator.clipboard.writeText(`${webOrigin}/invite/${employee.inviteToken}`);
    toast.success("Invite link copied to clipboard");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground rounded-lg p-2 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          {employee.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Always available */}
        <DropdownMenuItem onClick={copyEmail}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Email
        </DropdownMenuItem>

        {/* Invited-specific actions */}
        {isInvited && (
          <>
            <DropdownMenuItem onClick={copyInviteLink}>
              <Link className="mr-2 h-4 w-4" />
              Copy Invite Link
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuItem onClick={() => onResendInvite(employee.id, employee.email)}>
                  <Send className="mr-2 h-4 w-4" />
                  Resend Invite
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() =>
                    onConfirmAction({
                      type: "cancelInvite",
                      invitationId: employee.id,
                      name: employee.name,
                    })
                  }
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Invite
                </DropdownMenuItem>
              </>
            )}
          </>
        )}

        {/* Active/Trainee actions */}
        {isActionable && isAdmin && (
          <>
            {/* Role submenu */}
            {assignableRoles.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Shield className="mr-2 h-4 w-4" />
                  Change Role
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {assignableRoles.map((role) => (
                    <DropdownMenuItem
                      key={role}
                      disabled={employee.role.toLowerCase() === role}
                      onClick={() => onRoleChange(employee.profileId!, role)}
                    >
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                      {employee.role.toLowerCase() === role && (
                        <span className="text-muted-foreground ml-auto text-xs">Current</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Department submenu */}
            {departments.length > 0 && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Building2 className="mr-2 h-4 w-4" />
                  Change Department
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {departments.map((dept) => (
                    <DropdownMenuItem
                      key={dept.department_id}
                      disabled={employee.departmentId === dept.department_id}
                      onClick={() => onDepartmentChange(employee.profileId!, dept.department_id)}
                    >
                      {dept.name}
                      {employee.departmentId === dept.department_id && (
                        <span className="text-muted-foreground ml-auto text-xs">Current</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {/* Send contract */}
            {employee.profileId && onSendContract && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSendContract(employee.profileId!)}>
                  <FileSignature className="mr-2 h-4 w-4" />
                  Send kontrakt
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() =>
                onConfirmAction({
                  type: "resetPassword",
                  email: employee.email,
                  name: employee.name,
                })
              }
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Reset Password
            </DropdownMenuItem>

            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() =>
                onConfirmAction({
                  type: "deactivate",
                  profileId: employee.profileId!,
                  name: employee.name,
                })
              }
            >
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </DropdownMenuItem>
          </>
        )}

        {/* Offboarding — reactivation */}
        {employee.status === "offboarding" && isAdmin && employee.profileId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                onConfirmAction({
                  type: "reactivate",
                  profileId: employee.profileId!,
                  name: employee.name,
                })
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
