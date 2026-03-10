"use client";

/**
 * Knowledge test builder with question/option editor.
 * Creates multiple-choice questions with correct answers.
 * Connected to: use-governance-mutations.ts (useCreateKnowledgeTest)
 *
 * UI Events:
 * - action: addQuestion (adds question to list)
 * - action: addOption (adds option to question)
 * - action: setCorrectAnswer (marks correct option)
 * - action: submitTest (creates knowledge test)
 */

import { useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { useCreateKnowledgeTest } from "../_hooks/use-governance-mutations";

type OptionDraft = {
  id: string;
  text: string;
};

type QuestionDraft = {
  id: string;
  text: string;
  options: OptionDraft[];
  correctOptionId: string;
};

export function KnowledgeTestBuilder() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [protocolId, setProtocolId] = useState("");
  const [passThreshold, setPassThreshold] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>(undefined);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);

  const { workspace } = useWorkspace();
  const createTest = useCreateKnowledgeTest();

  const { data: protocols } = useQuery({
    queryKey: ["governance", "protocols", workspace.workspace_id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol")
        .select("protocol_id, name")
        .eq("workspace_id", workspace.workspace_id)
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  function addQuestion() {
    const qId = crypto.randomUUID();
    const optA = crypto.randomUUID();
    const optB = crypto.randomUUID();
    setQuestions((prev) => [
      ...prev,
      {
        id: qId,
        text: "",
        options: [
          { id: optA, text: "" },
          { id: optB, text: "" },
        ],
        correctOptionId: optA,
      },
    ]);
  }

  function removeQuestion(qId: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  }

  function updateQuestionText(qId: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, text } : q)));
  }

  function addOption(qId: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: [...q.options, { id: crypto.randomUUID(), text: "" }] } : q,
      ),
    );
  }

  function removeOption(qId: string, optId: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const newOpts = q.options.filter((o) => o.id !== optId);
        const correctStill = newOpts.some((o) => o.id === q.correctOptionId);
        return {
          ...q,
          options: newOpts,
          correctOptionId: correctStill ? q.correctOptionId : (newOpts[0]?.id ?? ""),
        };
      }),
    );
  }

  function updateOptionText(qId: string, optId: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => (o.id === optId ? { ...o, text } : o)) }
          : q,
      ),
    );
  }

  function setCorrectOption(qId: string, optId: string) {
    setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, correctOptionId: optId } : q)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !protocolId || questions.length === 0) return;

    createTest.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        protocol_id: protocolId,
        pass_threshold: passThreshold,
        max_attempts: maxAttempts,
        questions,
      },
      {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      },
    );
  }

  function resetForm() {
    setName("");
    setDescription("");
    setProtocolId("");
    setPassThreshold(70);
    setMaxAttempts(undefined);
    setQuestions([]);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors">
          <Plus className="h-4 w-4" />
          Ny Kunnskapstest
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[600px]">
        <SheetHeader>
          <SheetTitle>Opprett kunnskapstest</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-name">Navn</Label>
            <Input
              id="test-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. Allergentest"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tilhorende protokoll</Label>
            <Select value={protocolId} onValueChange={setProtocolId}>
              <SelectTrigger>
                <SelectValue placeholder="Velg protokoll..." />
              </SelectTrigger>
              <SelectContent>
                {(protocols ?? []).map((p) => (
                  <SelectItem key={p.protocol_id} value={p.protocol_id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bestattgrense (%)</Label>
              <Input
                type="number"
                value={passThreshold}
                onChange={(e) => setPassThreshold(parseInt(e.target.value) || 0)}
                min={0}
                max={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Maks forsok</Label>
              <Input
                type="number"
                value={maxAttempts ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  setMaxAttempts(isNaN(v) ? undefined : v);
                }}
                placeholder="Ubegrenset"
                min={1}
              />
            </div>
          </div>

          {/* Question builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sporsmal</Label>
              <button
                type="button"
                onClick={addQuestion}
                className="text-primary flex items-center gap-1 text-xs font-bold hover:underline"
              >
                <Plus className="h-3 w-3" />
                Legg til sporsmal
              </button>
            </div>

            {questions.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Ingen sporsmal lagt til.
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, qIdx) => (
                  <div key={q.id} className="border-border bg-muted/30 rounded-lg border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-muted-foreground text-xs font-bold">
                        Spm {qIdx + 1}
                      </span>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <Input
                      value={q.text}
                      onChange={(e) => updateQuestionText(q.id, e.target.value)}
                      placeholder="Skriv sporsmal..."
                      className="mb-2 text-sm"
                    />

                    {/* Options */}
                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCorrectOption(q.id, opt.id)}
                            className="shrink-0"
                          >
                            {q.correctOptionId === opt.id ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Circle className="text-muted-foreground h-4 w-4" />
                            )}
                          </button>
                          <Input
                            value={opt.text}
                            onChange={(e) => updateOptionText(q.id, opt.id, e.target.value)}
                            placeholder="Svaralternativ..."
                            className="h-8 text-xs"
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(q.id, opt.id)}
                              className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => addOption(q.id)}
                      className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[10px] font-medium hover:underline"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      Legg til alternativ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={
                createTest.isPending || !name.trim() || !protocolId || questions.length === 0
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50"
            >
              {createTest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Opprett
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
