"use client";

/**
 * TimeGutter — fixed left column showing hour labels for the Manager Timeline.
 *
 * Renders hour rows from DAY_START_HOUR (06:00) to DAY_END_HOUR (02:00 next day,
 * expressed as hour 26). Each row height is controlled by the CSS custom property
 * `--hour-h` set on the chart root element by the chart composer (Task 3.7).
 *
 * Labels: "HH:00" format, font-mono text-xs text-muted-foreground.
 * Hours 24+ (00:00–02:00 next day) are rendered with the wrapped display hour
 * so "25" → "01", "26" → "02".
 */

import { DAY_START_HOUR, DAY_END_HOUR } from "./timeMath";

export interface TimeGutterProps {
  /** Show half-hour tick marks between full hours. Default: false. */
  showHalf?: boolean;
}

export function TimeGutter({ showHalf = false }: TimeGutterProps) {
  const totalHours = DAY_END_HOUR - DAY_START_HOUR; // 20 hours

  return (
    <div className="relative select-none" style={{ width: "3.5rem" }} aria-hidden="true">
      {Array.from({ length: totalHours }, (_, i) => {
        const absoluteHour = DAY_START_HOUR + i; // 6..25
        const displayHour = absoluteHour % 24; // wraps 24→0, 25→1, 26→2
        const label = `${String(displayHour).padStart(2, "0")}:00`;
        const isNextDay = absoluteHour >= 24;

        return (
          <div
            key={absoluteHour}
            className="absolute right-2 flex items-start"
            style={{ top: `calc(${i} * var(--hour-h, 4rem))`, height: "var(--hour-h, 4rem)" }}
          >
            <span
              className={[
                "font-mono text-xs leading-none",
                isNextDay ? "text-muted-foreground/50" : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </span>
            {showHalf && (
              <span
                className="text-muted-foreground/30 absolute right-0 font-mono text-[0.6rem]"
                style={{ top: "calc(var(--hour-h, 4rem) / 2)" }}
              >
                :30
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
