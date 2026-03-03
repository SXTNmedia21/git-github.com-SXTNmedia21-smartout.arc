export default function DashboardLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-muted border-t-primary h-8 w-8 animate-spin rounded-full border-2" />
        <p className="text-muted-foreground text-sm">Laster...</p>
      </div>
    </div>
  );
}
