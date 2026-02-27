export function formatCurrency(amount: number, currency: string = "NOK"): string {
  return new Intl.NumberFormat("no-NO", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}t ${m}m`;
}
