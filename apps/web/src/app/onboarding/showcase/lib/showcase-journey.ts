export function computeJourneyProgress(input: {
  stepIndex: number;
  totalSteps: number;
  scrapeSuccesses: number;
  hasQuizAnswer: boolean;
}) {
  const stepProgress = ((input.stepIndex + 1) / Math.max(1, input.totalSteps)) * 70;
  const scrapeProgress = Math.min(20, input.scrapeSuccesses * 20);
  const quizProgress = input.hasQuizAnswer ? 10 : 0;
  return Math.min(100, Math.round(stepProgress + scrapeProgress + quizProgress));
}

export function computeUnderstandingScore(input: {
  quizCorrect: number;
  questionsAsked: number;
  scrapeSuccesses: number;
  interactionCount: number;
}) {
  return Math.min(
    100,
    Math.round(
      Math.min(40, input.quizCorrect * 20) +
        Math.min(24, input.questionsAsked * 6) +
        Math.min(24, input.scrapeSuccesses * 12) +
        Math.min(12, input.interactionCount / 2),
    ),
  );
}

export function inferUserProfile(input: {
  scrapeAttempts: number;
  questionsAsked: number;
  interactionCount: number;
}) {
  if (input.scrapeAttempts > 0 && input.questionsAsked > 0) return "Data-drevet utforsker";
  if (input.questionsAsked > 1) return "Nysgjerrig bruker";
  if (input.interactionCount > 10) return "Hands-on tester";
  return "Tidlig i journey";
}

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}
