"use client";

import { X, Mail, Phone, Building2, Briefcase, Plus, Loader2 } from "lucide-react";
import { useState, useContext, useEffect } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@smartout/supabase/client";
import { toast } from "sonner";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const inviteSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  emailOrPhone: z.string().min(5, "Contact info is required"),
  department_id: z.string().optional(),
  role: z.enum(["employee", "manager", "admin"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export function InviteMemberDialog({ isOpen, onClose }: InviteMemberDialogProps) {
  const { isDark, workspaceData } = useContext(DashboardContext);
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: "employee",
    },
  });

  useEffect(() => {
    if (!isOpen) {
      reset();
      setMethod("email");
    }
  }, [isOpen, reset]);

  if (!isOpen || !workspaceData) return null;

  const onSubmit = async (data: InviteFormValues) => {
    setIsSubmitting(true);
    try {
      // Check auth session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Split name rudimentary logic
      const nameParts = data.fullName.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      // Assuming email method for now as SMS might need deeper integration setup
      const email =
        method === "email"
          ? data.emailOrPhone
          : `${data.emailOrPhone.replace(/\\s/g, "")}@placeholder-sms.smartout.io`;

      const payload = {
        workspace_id: workspaceData.workspace_id,
        company_id: workspaceData.company_id,
        invites: [
          {
            email,
            first_name: firstName,
            last_name: lastName,
            role: data.role,
            department_ids: data.department_id ? [data.department_id] : [],
          },
        ],
      };

      const response = await supabase.functions.invoke("create-invitation", {
        body: payload,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Invitation sent successfully!");
      onClose();

      // TODO: Ideally we should invalidate the people/invites cache here
    } catch (error: unknown) {
      console.error("Failed to send invite:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send invitation. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isDark ? "bg-zinc-950/80" : "bg-zinc-800/30"} animate-in fade-in backdrop-blur-sm duration-200`}
    >
      <div
        className={`animate-in zoom-in-95 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl duration-200 ${isDark ? "border-zinc-800 bg-zinc-900" : "border-zinc-200 bg-white"}`}
      >
        <div
          className={`flex items-center justify-between border-b px-6 py-5 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-zinc-50"}`}
        >
          <div>
            <h2
              className={`text-lg leading-tight font-bold ${isDark ? "text-white" : "text-zinc-900"}`}
            >
              Invite Team Member
            </h2>
            <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Send an invitation to join {workspaceData?.name || "the workspace"}.
            </p>
          </div>
          <button
            onClick={onClose}
            className={`rounded-full p-2 transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200" : "text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-6 p-6">
            <div
              className={`flex rounded-lg border p-1 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-white"}`}
            >
              <button
                type="button"
                onClick={() => setMethod("email")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
                  method === "email"
                    ? isDark
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-900 shadow-sm"
                    : isDark
                      ? "text-zinc-400 hover:text-zinc-300"
                      : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                <Mail className="h-4 w-4" /> Email
              </button>
              <button
                type="button"
                onClick={() => setMethod("phone")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all ${
                  method === "phone"
                    ? isDark
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-900 shadow-sm"
                    : isDark
                      ? "text-zinc-400 hover:text-zinc-300"
                      : "text-zinc-400 hover:text-zinc-700"
                }`}
              >
                <Phone className="h-4 w-4" /> SMS
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  Full Name
                </label>
                <input
                  {...register("fullName")}
                  type="text"
                  placeholder="e.g. Kari Nordmann"
                  className={`w-full rounded-lg px-4 py-2.5 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"}`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                >
                  {method === "email" ? "Email Address" : "Phone Number"}
                </label>
                <input
                  {...register("emailOrPhone")}
                  type={method === "email" ? "email" : "tel"}
                  placeholder={method === "email" ? "kari@example.com" : "+47 900 00 000"}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm transition-all focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-950 text-white placeholder:text-zinc-600" : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400"}`}
                />
                {errors.emailOrPhone && (
                  <p className="mt-1 text-xs text-red-500">{errors.emailOrPhone.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label
                    className={`flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    <Building2 className="h-3.5 w-3.5" /> Department
                  </label>
                  <select
                    {...register("department_id")}
                    className={`w-full appearance-none rounded-lg px-3 py-2.5 text-sm focus:border-orange-500/50 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-900"}`}
                  >
                    <option value="">No Department</option>
                    {/* TODO: Map actual departments from DB */}
                    <option value="dept-1">Kitchen</option>
                    <option value="dept-2">Service</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label
                    className={`flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase ${isDark ? "text-zinc-400" : "text-zinc-500"}`}
                  >
                    <Briefcase className="h-3.5 w-3.5" /> System Role
                  </label>
                  <select
                    {...register("role")}
                    className={`w-full appearance-none rounded-lg px-3 py-2.5 text-sm focus:border-orange-500/50 focus:outline-none ${isDark ? "border-zinc-800 bg-zinc-950 text-white" : "border-zinc-200 bg-white text-zinc-900"}`}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`flex justify-end gap-3 border-t px-6 py-4 ${isDark ? "border-zinc-800 bg-zinc-950" : "border-zinc-200 bg-zinc-50"}`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isDark ? "text-zinc-400 hover:bg-zinc-800 hover:text-white" : "text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"}`}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-orange-400 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isSubmitting ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
