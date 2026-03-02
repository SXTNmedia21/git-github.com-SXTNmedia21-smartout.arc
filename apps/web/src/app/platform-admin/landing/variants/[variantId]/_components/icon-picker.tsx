// ============================================
// icon-picker.tsx — Searchable Lucide icon picker
// Shows a popover with ~40 common icons used in landing blocks.
// Returns icon name string on selection.
//
// Connected to: forms/* (used in features/icons forms)
// ============================================

"use client";

import { useState, useMemo } from "react";
import {
  Zap,
  Shield,
  Clock,
  Users,
  BarChart3,
  Heart,
  Star,
  Globe,
  Lock,
  Rocket,
  Target,
  Lightbulb,
  TrendingUp,
  CheckCircle,
  Award,
  Headphones,
  MessageCircle,
  BookOpen,
  Layers,
  Settings,
  Bell,
  Calendar,
  FileText,
  Smartphone,
  Monitor,
  Wifi,
  Cloud,
  Database,
  Cpu,
  Eye,
  Mic,
  Play,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  ThumbsUp,
  Wrench,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  shield: Shield,
  clock: Clock,
  users: Users,
  "bar-chart-3": BarChart3,
  heart: Heart,
  star: Star,
  globe: Globe,
  lock: Lock,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  "trending-up": TrendingUp,
  "check-circle": CheckCircle,
  award: Award,
  headphones: Headphones,
  "message-circle": MessageCircle,
  "book-open": BookOpen,
  layers: Layers,
  settings: Settings,
  bell: Bell,
  calendar: Calendar,
  "file-text": FileText,
  smartphone: Smartphone,
  monitor: Monitor,
  wifi: Wifi,
  cloud: Cloud,
  database: Database,
  cpu: Cpu,
  eye: Eye,
  mic: Mic,
  play: Play,
  "refresh-cw": RefreshCw,
  search: Search,
  send: Send,
  sparkles: Sparkles,
  "thumbs-up": ThumbsUp,
  wrench: Wrench,
  "arrow-right": ArrowRight,
};

type IconPickerProps = {
  value: string;
  onChange: (iconName: string) => void;
};

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredIcons = useMemo(() => {
    if (!query) return Object.entries(ICON_MAP);
    const lower = query.toLowerCase();
    return Object.entries(ICON_MAP).filter(([name]) => name.toLowerCase().includes(lower));
  }, [query]);

  const SelectedIcon = ICON_MAP[value];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-full justify-start gap-2">
          {SelectedIcon ? <SelectedIcon className="h-4 w-4 shrink-0" /> : null}
          <span className="truncate text-xs">{value || "Velg ikon..."}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <Input
          placeholder="Soek ikon..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-2 h-8 text-xs"
        />
        <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
          {filteredIcons.map(([name, Icon]) => (
            <button
              key={name}
              type="button"
              className={`hover:bg-accent flex h-8 w-8 items-center justify-center rounded-md ${
                value === name ? "bg-accent ring-ring ring-1" : ""
              }`}
              title={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
                setQuery("");
              }}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          {filteredIcons.length === 0 && (
            <p className="text-muted-foreground col-span-6 py-4 text-center text-xs">
              Ingen ikoner funnet
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
