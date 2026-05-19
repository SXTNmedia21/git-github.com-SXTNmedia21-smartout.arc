// ============================================
// GlobalCreateMenu.tsx
// Header-level "Ny ▾" dropdown — always visible far right.
// All items wire to existing flows — no new tables, no new logic.
// - Event / Booking → /dashboard/calendar?new=
// - Nyhet → AnnounceSheet (cockpit reuse, wraps QuickBroadcast)
// - Shift → /dashboard/schedule (AddShiftDialog lives there)
// - Oppgave → /dashboard/operations (TasksTab uses AddTaskDialog)
// - Avvik → /dashboard/hms (deviation creation today is mobile-only;
//   toast hint surfaces that until web-side flow lands)
// ============================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Clock,
  Megaphone,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnnounceSheet } from "@/components/dashboard/cockpit/sheets/AnnounceSheet";

type GlobalCreateMenuProps = {
  profileId?: string;
};

type Item = {
  key: string;
  label: string;
  hint: string;
  icon: typeof Plus;
  action: "route" | "announce";
  href?: string;
  toastOnRoute?: { title: string; description?: string };
};

export function GlobalCreateMenu({ profileId }: GlobalCreateMenuProps) {
  const router = useRouter();
  const [announceOpen, setAnnounceOpen] = useState(false);

  const items: Item[] = [
    {
      key: "event",
      label: "Event",
      hint: "Møte, milepæl, frist",
      icon: CalendarDays,
      action: "route",
      href: "/dashboard/calendar?new=event",
    },
    {
      key: "booking",
      label: "Booking",
      hint: "Gjest, gruppe, reservasjon",
      icon: Users,
      action: "route",
      href: "/dashboard/calendar?new=booking",
    },
    {
      key: "shift",
      label: "Vakt",
      hint: "Planlegg ny vakt (D6)",
      icon: Clock,
      action: "route",
      href: "/dashboard/schedule",
    },
    {
      key: "task",
      label: "Oppgave",
      hint: "Sesjonsoppgave (D6 session_task)",
      icon: CheckSquare,
      action: "route",
      href: "/dashboard/operations",
    },
    {
      key: "deviation",
      label: "Avvik",
      hint: "Rapporter avvik",
      icon: AlertTriangle,
      action: "route",
      href: "/dashboard/hms",
      toastOnRoute: {
        title: "Avvik",
        description: "Logges enklest fra mobilens deviation-flow.",
      },
    },
    {
      key: "news",
      label: "Nyhet",
      hint: "Kunngjøring til teamet",
      icon: Megaphone,
      action: "announce",
    },
  ];

  const handleSelect = (item: Item) => {
    if (item.action === "announce") {
      if (!profileId) {
        toast.error("Mangler profil-kontekst");
        return;
      }
      setAnnounceOpen(true);
      return;
    }
    if (item.href) {
      router.push(item.href);
      if (item.toastOnRoute) {
        toast.message(item.toastOnRoute.title, {
          description: item.toastOnRoute.description,
        });
      }
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="group gap-1.5 rounded-lg bg-[var(--info)] text-white shadow-sm transition-all hover:bg-[var(--info-foreground)] hover:shadow-[var(--shadow-cta-sm)] hover:shadow-md"
          >
            <Plus className="h-4 w-4 transition-transform group-data-[state=open]:rotate-45" />
            <span className="font-semibold">Ny</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-80 transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
            Opprett
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((item) => {
            const Icon = item.icon;
            const disabled = item.action === "announce" && !profileId;
            return (
              <DropdownMenuItem
                key={item.key}
                onSelect={() => handleSelect(item)}
                disabled={disabled}
                className="gap-2"
              >
                <Icon className="text-muted-foreground h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="text-muted-foreground text-[11px]">{item.hint}</span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {profileId ? (
        <AnnounceSheet open={announceOpen} onOpenChange={setAnnounceOpen} profileId={profileId} />
      ) : null}
    </>
  );
}
