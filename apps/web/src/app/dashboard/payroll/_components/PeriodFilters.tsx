"use client";

import { Button } from "@/components/ui/button";

type Props = {
  year: number;
  onYearChange: (year: number) => void;
};

/**
 * Year-picker filter strip for the payroll period list.
 * Shows two previous years and the current year as toggleable buttons.
 */
export function PeriodFilters({ year, onYearChange }: Props) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm font-medium">År:</span>
      {years.map((y) => (
        <Button
          key={y}
          variant={y === year ? "default" : "outline"}
          size="sm"
          onClick={() => onYearChange(y)}
        >
          {y}
        </Button>
      ))}
    </div>
  );
}
