"use client";

export function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-2" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="bg-muted h-2.5 w-16 animate-pulse rounded" />
          <div className="bg-muted h-4 w-full animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}
