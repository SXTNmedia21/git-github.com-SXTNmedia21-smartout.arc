"use client";

/**
 * GridEmployeePicker — Popover for assigning an employee to a grid slot.
 * Opens when clicking "+ Tilordne" in an empty cell. Shows a searchable
 * list of employees filtered by the department of the selected column.
 */

import { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmployees, type ScheduleEmployee } from "../_hooks/use-employees";

type GridEmployeePickerProps = {
  /** The trigger element (typically the "+ Tilordne" button) */
  children: React.ReactNode;
  /** Filter employees by this department ID. null = show all. */
  departmentId: string | null;
  /** Called when an employee is selected */
  onSelect: (employee: ScheduleEmployee) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GridEmployeePicker({
  children,
  departmentId,
  onSelect,
  open,
  onOpenChange,
}: GridEmployeePickerProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: employees = [] } = useEmployees();

  // Filter by department, then by search term
  const filtered = useMemo(() => {
    let list = employees;
    if (departmentId) {
      list = list.filter((e) => e.departmentId === departmentId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          e.team.toLowerCase().includes(q),
      );
    }
    return list;
  }, [employees, departmentId, search]);

  // Focus the search input when the popover opens
  useEffect(() => {
    if (open) {
      setSearch("");
      // Small delay so the popover is mounted before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start" sideOffset={4}>
        {/* Search input */}
        <div className="border-border flex items-center gap-2 border-b px-3 py-2">
          <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Søk ansatt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-foreground placeholder:text-muted-foreground w-full border-none bg-transparent text-xs outline-none"
          />
        </div>

        {/* Employee list */}
        <div className="max-h-[240px] overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="text-muted-foreground px-3 py-4 text-center text-xs">
              Ingen ansatte funnet
            </div>
          )}
          {filtered.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => {
                onSelect(emp);
                onOpenChange(false);
              }}
              className="hover:bg-muted flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left transition-colors"
            >
              {/* Avatar */}
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${emp.avatarColor}`}
              >
                {emp.initials}
              </span>

              {/* Name + role */}
              <div className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-xs font-semibold">
                  {emp.name}
                </span>
                {emp.jobTitle && (
                  <span className="text-muted-foreground block truncate text-[10px]">
                    {emp.jobTitle}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
