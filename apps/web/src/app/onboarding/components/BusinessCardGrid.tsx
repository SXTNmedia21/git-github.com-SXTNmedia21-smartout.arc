"use client";

import { useState, useCallback, useRef, useEffect, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  MapPin,
  Phone,
  FileText,
  Check,
  Pencil,
  Star,
  ExternalLink,
} from "lucide-react";
import type { BusinessData } from "../types";
import { EASE_EXPO } from "../lib/motion";

// UI Events:
// - action: editField(cardId, fieldKey) — click field row to edit inline
// - action: saveField(fieldKey, value) — Enter or click save
// - action: cancelEdit() — Escape or click cancel
// - color-regime: must-have fields glow orange when empty

type FieldKey = keyof BusinessData;

interface FieldDef {
  key: FieldKey;
  label: string;
  must: boolean;
  format?: (val: string, data: BusinessData) => string;
  readonly?: boolean;
}

interface CardDef {
  id: string;
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

const ICON_CLS = "h-4 w-4";

const CARDS: CardDef[] = [
  {
    id: "identity",
    title: "Identitet",
    icon: <Building2 className={ICON_CLS} />,
    fields: [
      { key: "name", label: "Bedriftsnavn", must: true },
      { key: "legalName", label: "Juridisk navn", must: true },
      { key: "orgNumber", label: "Org.nummer", must: true },
      { key: "industry", label: "Bransje", must: true },
      { key: "employeeCount", label: "Antall ansatte", must: false },
    ],
  },
  {
    id: "location",
    title: "Lokasjon",
    icon: <MapPin className={ICON_CLS} />,
    fields: [
      { key: "address", label: "Gateadresse", must: true },
      { key: "postalCode", label: "Postnummer", must: true },
      { key: "city", label: "By", must: true },
      {
        key: "googleMapsUrl",
        label: "Google Maps",
        must: false,
        readonly: true,
        format: (val) => (val ? "Åpne i Maps ↗" : ""),
      },
      {
        key: "googleRating",
        label: "Vurdering",
        must: false,
        readonly: true,
        format: (val, data) =>
          val
            ? `${val}/5${data.googleRatingCount ? ` · ${data.googleRatingCount} anmeldelser` : ""}`
            : "",
      },
    ],
  },
  {
    id: "contact",
    title: "Kontakt",
    icon: <Phone className={ICON_CLS} />,
    fields: [
      { key: "email", label: "E-post", must: true },
      { key: "phone", label: "Telefon", must: true },
      { key: "website", label: "Nettside", must: false },
      { key: "openingHours", label: "Åpningstider", must: false },
    ],
  },
  {
    id: "profile",
    title: "Profil",
    icon: <FileText className={ICON_CLS} />,
    fields: [
      { key: "description", label: "Beskrivelse", must: false },
      { key: "priceLevel", label: "Prisnivå", must: false },
      { key: "logoUrl", label: "Logo", must: false },
    ],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.7,
      ease: EASE_EXPO,
      delay: i * 0.08,
    },
  }),
};

const valueVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.35,
      ease: EASE_EXPO,
    },
  },
};

interface BusinessCardGridProps {
  business: BusinessData;
  onUpdate: (partial: Partial<BusinessData>) => void;
  isScraping: boolean;
}

export function BusinessCardGrid({ business, onUpdate, isScraping }: BusinessCardGridProps) {
  const [editingField, setEditingField] = useState<FieldKey | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  const startEdit = useCallback(
    (key: FieldKey, isReadonly: boolean) => {
      if (isScraping || isReadonly) return;
      setEditingField(key);
    },
    [isScraping],
  );

  const saveEdit = useCallback(
    (key: FieldKey, value: string) => {
      onUpdate({ [key]: value });
      setEditingField(null);
    },
    [onUpdate],
  );

  const cancelEdit = useCallback(() => setEditingField(null), []);

  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CARDS.map((card, cardIdx) => {
          const emptyMustInCard = card.fields.filter((f) => f.must && !business[f.key]).length;
          const hasAnyValue = card.fields.some((f) => !!business[f.key]);

          return (
            <motion.div
              key={card.id}
              custom={cardIdx}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="group"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm">
                {/* Card header */}
                <div className="flex items-center gap-2.5 border-b border-white/[0.05] px-5 py-3.5">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      hasAnyValue
                        ? "bg-white/[0.08] text-white/60"
                        : "bg-white/[0.04] text-white/30"
                    }`}
                  >
                    {card.icon}
                  </div>
                  <span className="text-sm font-medium text-white/70">{card.title}</span>
                  {emptyMustInCard === 0 && hasAnyValue && !isScraping && (
                    <Check className="ml-auto h-3.5 w-3.5 text-white/20" />
                  )}
                </div>

                {/* Fields */}
                <div className="divide-y divide-white/[0.03] px-5">
                  {card.fields.map((field) => {
                    const rawValue = (business[field.key] as string) ?? "";
                    const displayValue = field.format ? field.format(rawValue, business) : rawValue;
                    const isEmpty = !rawValue;
                    const isEditing = editingField === field.key;
                    const isUrl = field.key === "googleMapsUrl" && rawValue;

                    return (
                      <div
                        key={field.key}
                        className={`flex items-baseline gap-3 py-2.5 ${
                          !isEditing && !field.readonly && !isScraping ? "cursor-pointer" : ""
                        }`}
                        onClick={() => {
                          if (!isEditing) startEdit(field.key, field.readonly ?? false);
                        }}
                      >
                        {/* Label */}
                        <span
                          className={`w-[110px] shrink-0 text-[11px] font-medium tracking-wide ${
                            field.must && isEmpty
                              ? "text-[var(--brand-orange)]/60"
                              : "text-white/35"
                          }`}
                        >
                          {field.label}
                        </span>

                        {/* Value / edit / skeleton */}
                        <div className="min-w-0 flex-1">
                          {isEditing && !field.readonly ? (
                            <EditField
                              ref={inputRef}
                              initialValue={rawValue}
                              isMultiline={field.key === "description"}
                              onSave={(v) => saveEdit(field.key, v)}
                              onCancel={cancelEdit}
                            />
                          ) : isScraping ? (
                            <div className="h-4 w-2/3 animate-pulse rounded-md bg-white/[0.06]" />
                          ) : isUrl ? (
                            <a
                              href={rawValue}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-white/50 transition-colors hover:text-white/80"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {displayValue}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : field.key === "googleRating" && rawValue ? (
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={displayValue}
                                variants={valueVariants}
                                initial="hidden"
                                animate="visible"
                                className="flex items-center gap-1 text-sm text-white/70"
                              >
                                <Star className="h-3 w-3 fill-white/50 text-white/50" />
                                {displayValue}
                              </motion.span>
                            </AnimatePresence>
                          ) : isEmpty ? (
                            <span
                              className={`text-sm ${
                                field.must ? "text-[var(--brand-orange)]/50" : "text-white/20"
                              }`}
                            >
                              {field.must ? "Mangler" : "—"}
                            </span>
                          ) : (
                            <AnimatePresence mode="wait">
                              <motion.p
                                key={displayValue}
                                variants={valueVariants}
                                initial="hidden"
                                animate="visible"
                                className={`text-sm leading-relaxed ${
                                  field.key === "description"
                                    ? "line-clamp-2 text-white/60"
                                    : "truncate text-white/80"
                                }`}
                                title={rawValue}
                              >
                                {displayValue}
                              </motion.p>
                            </AnimatePresence>
                          )}
                        </div>

                        {/* Edit pencil hint */}
                        {!isEditing && !field.readonly && !isScraping && !isEmpty && (
                          <Pencil className="h-3 w-3 shrink-0 text-white/0 transition-colors group-hover:text-white/20" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// --- Inline edit field ---

interface EditFieldProps {
  initialValue: string;
  isMultiline?: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
}

const EditField = forwardRef<HTMLInputElement | HTMLTextAreaElement, EditFieldProps>(
  function EditField({ initialValue, isMultiline = false, onSave, onCancel }, ref) {
    const [value, setValue] = useState(initialValue);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave(value);
        }
        if (e.key === "Escape") {
          onCancel();
        }
      },
      [value, onSave, onCancel],
    );

    const commonClasses =
      "w-full rounded-lg border border-white/[0.12] bg-white/[0.06] px-2.5 py-1.5 text-sm text-white placeholder:text-white/25 focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20 focus:outline-none";

    return (
      <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
        {isMultiline ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            className={`${commonClasses} resize-none`}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className={commonClasses}
          />
        )}
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-0.5 text-xs text-white/30 transition-colors hover:text-white/50"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => onSave(value)}
            className="flex items-center gap-1 rounded-md bg-white/[0.08] px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/[0.12]"
          >
            <Check className="h-3 w-3" />
            Lagre
          </button>
        </div>
      </div>
    );
  },
);
