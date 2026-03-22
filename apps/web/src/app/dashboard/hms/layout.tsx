import { HmsSubNav } from "./_components/HmsSubNav";

export default function HmsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <HmsSubNav />
      {children}
    </div>
  );
}
