import type { BlockSettings } from "../../lib/block-schemas";

/** Returns Tailwind padding classes based on the block settings.padding value. */
export function getPaddingClasses(padding: BlockSettings["padding"]): string {
  switch (padding) {
    case "sm":
      return "py-12 md:py-16";
    case "lg":
      return "py-28 md:py-36";
    case "md":
    default:
      return "py-20 md:py-28";
  }
}

/** Returns Tailwind max-width classes based on the block settings.layout value. */
export function getLayoutClasses(layout: BlockSettings["layout"]): string {
  switch (layout) {
    case "narrow":
      return "max-w-4xl";
    case "wide":
      return "max-w-[90rem]";
    case "default":
    default:
      return "max-w-7xl";
  }
}

/** Returns background classes based on the block settings.background value. */
export function getBackgroundClasses(background: BlockSettings["background"]): string {
  switch (background) {
    case "subtle":
      return "bg-white/[0.02]";
    case "dark":
      return "bg-zinc-900/50";
    case "none":
    default:
      return "";
  }
}
