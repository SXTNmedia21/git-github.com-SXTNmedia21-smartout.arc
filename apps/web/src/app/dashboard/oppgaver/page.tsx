/**
 * Manager Timeline (/dashboard/oppgaver) — page entry.
 *
 * Server Component. Resolves no data here — the client shell owns the active
 * date + active department via the URL + workspace context. Page only mounts
 * the shell.
 */
import { ManagerTimelineShell } from "./_components/ManagerTimelineShell";

export default function OppgaverPage() {
  return <ManagerTimelineShell />;
}
