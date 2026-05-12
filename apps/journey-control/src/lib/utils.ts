// cn() — merge Tailwind classes without conflicts.
// Uses clsx for conditional logic + tailwind-merge for deduplication.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
