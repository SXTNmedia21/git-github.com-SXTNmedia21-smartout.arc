"use client";

// Notes tab: internal admin notes per workspace — add, edit, delete.
// Exports NoteRow so the shell can reference the type when passing initialNotes.

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

// ── Exported type ────────────────────────────────────────────────────────────

export type NoteRow = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialNotes: NoteRow[];
  workspaceId: string;
};

export function NotesTab({ initialNotes, workspaceId }: Props) {
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  async function saveNote() {
    if (!noteText.trim()) return;
    setIsSavingNote(true);
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          content: noteText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save note");
      const { note } = await res.json();
      const now = new Date().toISOString();
      setNotes([
        {
          id: note.note_id,
          text: note.content,
          createdAt: note.created_at ?? now,
          updatedAt: now,
        },
        ...notes,
      ]);
      setNoteText("");
      toast.success("Note saved");
    } catch {
      toast.error("Failed to save note");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function updateNote(noteId: string) {
    if (!editingText.trim()) return;
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content: editingText.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update note");
      setNotes(
        notes.map((n) =>
          n.id === noteId
            ? { ...n, text: editingText.trim(), updatedAt: new Date().toISOString() }
            : n,
        ),
      );
      setEditingNoteId(null);
      setEditingText("");
      toast.success("Note updated");
    } catch {
      toast.error("Failed to update note");
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const res = await fetch("/api/platform-admin/workspace-notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });
      if (!res.ok) throw new Error("Failed to delete note");
      setNotes(notes.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch {
      toast.error("Failed to delete note");
    }
  }

  return (
    <TabsContent value="notes" className="mt-4 space-y-4">
      {/* New note input */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note..."
            className="min-h-[80px] text-sm"
          />
          <Button size="sm" onClick={saveNote} disabled={!noteText.trim() || isSavingNote}>
            <StickyNote className="mr-1 h-3 w-3" /> Save Note
          </Button>
        </CardContent>
      </Card>

      {/* Existing notes list */}
      {notes.length > 0 && (
        <div className="space-y-2">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-3">
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateNote(note.id)}
                        disabled={!editingText.trim()}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingNoteId(null);
                          setEditingText("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{note.text}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-muted-foreground text-xs">
                        {new Date(note.createdAt).toLocaleString("no-NO")}
                        {note.updatedAt !== note.createdAt && " (edited)"}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingText(note.text);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-6 px-2 text-xs"
                          onClick={() => deleteNote(note.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </TabsContent>
  );
}
