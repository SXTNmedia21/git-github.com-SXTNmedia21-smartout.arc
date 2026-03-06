export function canSpeak(input: { voiceEnabled: boolean; hasManualTrigger: boolean }) {
  return input.voiceEnabled && input.hasManualTrigger;
}

export function getCapabilityState(input: { hasScrapeUrl: boolean; manualSpeech: boolean }) {
  return {
    navigate: "enabled",
    fill: "enabled",
    highlight: "enabled",
    fetch: input.hasScrapeUrl ? "enabled" : "idle",
    speech: input.manualSpeech ? "manual" : "disabled",
  } as const;
}

export function getPolicySummary(input: { manualSpeech: boolean }) {
  return input.manualSpeech
    ? "Speech policy: manual-only trigger."
    : "Speech policy: disabled until manually enabled.";
}
