/**
 * AdminTopbar.tsx — top bar with workspace context + signed-in pill
 *
 * Shows how many companies this accountant has access to.
 * Sign-out button POSTs to /auth/logout.
 */
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  userId: string;
  companyCount: number;
};

export function AdminTopbar({ companyCount }: Props) {
  return (
    <header className="bg-card border-border flex h-14 items-center justify-between border-b px-6">
      <span className="text-muted-foreground text-sm">
        {companyCount} {companyCount === 1 ? "bedrift" : "bedrifter"}
      </span>

      <form action="/auth/logout" method="POST">
        <Button type="submit" variant="ghost" size="sm" className="gap-1.5">
          <LogOut className="h-3.5 w-3.5" />
          Logg ut
        </Button>
      </form>
    </header>
  );
}
