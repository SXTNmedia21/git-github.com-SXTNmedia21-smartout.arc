/**
 * utils.ts — shared utility: cn() class merger
 *
 * Combines clsx + tailwind-merge. Standard Smartout pattern.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
