export function calculateReadinessScore(completedTasks: number, totalAssigned: number): number {
  if (totalAssigned === 0) return 100;
  return Math.round((completedTasks / totalAssigned) * 100);
}
