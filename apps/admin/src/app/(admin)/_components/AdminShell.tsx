/**
 * AdminShell.tsx — shell wrapper for admin layout
 *
 * Dark-capable container. Renders sidebar + main area side-by-side.
 */

type Props = {
  children: React.ReactNode;
};

export function AdminShell({ children }: Props) {
  return (
    <div className="bg-background text-foreground flex h-screen w-full overflow-hidden">
      {children}
    </div>
  );
}
