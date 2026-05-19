export default function RolesLoading() {
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col p-4 pt-1 md:p-6 md:pt-3">
      <div className="mb-5">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted mt-2 h-4 w-48 animate-pulse rounded" />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-card border-border h-24 animate-pulse rounded-2xl border" />
        ))}
      </div>
      <div className="bg-card border-border min-h-0 flex-1 animate-pulse rounded-2xl border shadow-sm" />
    </div>
  );
}
