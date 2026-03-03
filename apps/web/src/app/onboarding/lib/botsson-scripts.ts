import type { BotssonScript, OnboardingSection } from "../types";

export const BOTSSON_SCRIPTS: BotssonScript[] = [
  {
    section: "hero",
    trigger: "enter",
    text: "Hei! Jeg er Mr. Botsson, din AI-assistent. La oss sette opp arbeidsplassen din på under fem minutter.",
  },
  {
    section: "business",
    trigger: "enter",
    text: "Skriv inn nettsiden eller organisasjonsnummeret ditt, så finner jeg all informasjon automatisk.",
    delay: 500,
  },
  {
    section: "business",
    trigger: "complete",
    text: "Perfekt! Jeg fant bedriften din. Sjekk at alt stemmer, og korriger det som er feil.",
  },
  {
    section: "business",
    trigger: "error",
    text: "Hmm, jeg klarte ikke å finne informasjonen. Fyll inn manuelt, så hjelper jeg deg videre.",
  },
  {
    section: "season",
    trigger: "enter",
    text: "Sesonger organiserer drift, mål og bemanning i perioder. Jeg har foreslått en basert på dagens dato.",
    delay: 300,
  },
  {
    section: "departments",
    trigger: "enter",
    text: "Basert på bransjen din har jeg foreslått noen avdelinger. Fjern de som ikke passer, eller legg til egne.",
    delay: 300,
  },
  {
    section: "contract",
    trigger: "enter",
    text: "Siste steg! Jeg har laget en kontraktmal basert på norsk arbeidsmiljølov og din bedrift.",
    delay: 300,
  },
  {
    section: "done",
    trigger: "enter",
    text: "Gratulerer! Alt er klart. Velkommen til Smartout. Nå kan du invitere ansatte og sette opp vaktplaner.",
  },
];

export function getScriptsForSection(
  section: OnboardingSection,
  trigger: BotssonScript["trigger"],
): BotssonScript[] {
  return BOTSSON_SCRIPTS.filter((s) => s.section === section && s.trigger === trigger);
}
