import { notFound } from "next/navigation";

/**
 * Catch-all slug route. Previously mapped perspective slugs to landing variants.
 * Variants are archived — all slugs now return 404.
 */
export default function PerspectivePage() {
  notFound();
}
