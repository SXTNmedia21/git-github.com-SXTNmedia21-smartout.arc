"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CONTRACT_TYPES = [
  { value: "client", label: "Klient" },
  { value: "employee", label: "Ansatt" },
  { value: "haccp", label: "HACCP" },
  { value: "training", label: "Opplaering" },
  { value: "season", label: "Sesong" },
  { value: "custom", label: "Egendefinert" },
];

const LANGUAGES = [
  { value: "no", label: "Norsk" },
  { value: "en", label: "English" },
  { value: "sv", label: "Svenska" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

type MetadataBarProps = {
  name: string;
  onNameChange: (name: string) => void;
  contractType: string;
  onContractTypeChange: (type: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  status: string;
  description: string;
  onDescriptionChange: (desc: string) => void;
};

export function MetadataBar({
  name,
  onNameChange,
  contractType,
  onContractTypeChange,
  language,
  onLanguageChange,
  status,
  description,
  onDescriptionChange,
}: MetadataBarProps) {
  const [showDescription, setShowDescription] = useState(!!description);

  return (
    <div className="border-border bg-background space-y-2 border-b px-4 py-2.5">
      {/* Row 1: Name + Type */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-8 text-sm font-semibold"
            placeholder="Malnavn"
          />
        </div>
        <Select value={contractType} onValueChange={onContractTypeChange}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Language + Status + Description toggle */}
      <div className="flex items-center gap-3">
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className={STATUS_COLORS[status] || STATUS_COLORS.draft}>
          {status === "draft" ? "Utkast" : status === "active" ? "Aktiv" : "Arkivert"}
        </Badge>

        <button
          type="button"
          onClick={() => setShowDescription(!showDescription)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
        >
          {showDescription ? (
            <>
              <ChevronUp className="h-3 w-3" /> Skjul beskrivelse
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> + Beskrivelse
            </>
          )}
        </button>
      </div>

      {/* Collapsible description */}
      {showDescription && (
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Beskriv malen (valgfritt)..."
          className="bg-muted/50 text-foreground placeholder:text-muted-foreground focus:ring-ring h-16 w-full resize-none rounded-md border px-3 py-2 text-xs focus:ring-1 focus:outline-none"
        />
      )}
    </div>
  );
}
