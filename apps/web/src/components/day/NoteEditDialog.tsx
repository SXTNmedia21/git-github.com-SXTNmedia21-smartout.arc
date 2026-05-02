"use client";

import { useContext, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@smartout/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";

const MIN_LENGTH = 3;

export function NoteEditDialog({
  open,
  sessionId,
  noteId,
  onClose,
  onSaved,
}: {
  open: boolean;
  sessionId: string;
  noteId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ctx = useWorkspaceOptional();
  const dashCtx = useContext(DashboardContext);
  const wsId = ctx?.workspace.workspace_id;
  const profileId = dashCtx.profileId;
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load note when opened with an id.
  useEffect(() => {
    if (!open) return;
    if (!noteId) {
      setContent("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_note")
        .select("content")
        .eq("id", noteId)
        .single();
      if (!cancelled) {
        if (error) toast.error(error.message);
        else setContent(data?.content ?? "");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, noteId]);

  const trimmed = content.trim();
  const tooShort = trimmed.length < MIN_LENGTH;

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (tooShort || !wsId || !profileId) return;
    startTransition(async () => {
      const supabase = createClient();
      if (noteId) {
        const { error } = await supabase
          .from("session_note")
          .update({ content: trimmed })
          .eq("id", noteId);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Notat oppdatert");
      } else {
        const { error } = await supabase.from("session_note").insert({
          workspace_id: wsId,
          department_session_id: sessionId,
          content: trimmed,
          note_type: "general",
          created_by: profileId,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Notat lagt til");
      }
      onSaved();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">
            {noteId ? "Rediger notat" : "Nytt notat"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Notater festes til sesjonen og synlig i revisjonsloggen.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <textarea
          autoFocus
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={loading || isPending}
          placeholder="Skriv notatet…"
          className="bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Avbryt</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={tooShort || isPending}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            Lagre
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
