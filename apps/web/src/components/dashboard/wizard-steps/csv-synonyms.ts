// csv-synonyms.ts

export type MappableField = {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "date" | "lookup";
};

export const MAPPABLE_FIELDS: MappableField[] = [
  { key: "firstName", label: "Fornavn", required: true, type: "text" },
  { key: "lastName", label: "Etternavn", required: true, type: "text" },
  { key: "email", label: "E-post", required: true, type: "text" },
  { key: "phone", label: "Telefon", required: false, type: "text" },
  { key: "departmentId", label: "Avdeling", required: false, type: "lookup" },
  { key: "positionId", label: "Stilling", required: false, type: "lookup" },
  { key: "employmentForm", label: "Ansettelsesform", required: false, type: "lookup" },
  { key: "hourlyRate", label: "Timelønn", required: false, type: "number" },
  { key: "startDate", label: "Startdato", required: false, type: "date" },
  { key: "positionPct", label: "Stillingsprosent", required: false, type: "number" },
  { key: "birthDate", label: "Fødselsdato", required: false, type: "date" },
  { key: "address", label: "Adresse", required: false, type: "text" },
];

const SYNONYMS: Record<string, string[]> = {
  firstName: ["fornavn", "first_name", "firstname", "förnamn", "namn", "name"],
  lastName: ["etternavn", "last_name", "lastname", "efternamn", "surname"],
  email: ["e-post", "epost", "email", "mail", "e-mail"],
  phone: ["telefon", "phone", "tlf", "mobil", "mobilnummer", "mob"],
  departmentId: ["avdeling", "department", "dept", "avd"],
  positionId: ["stilling", "position", "rolle", "role", "title", "tittel"],
  employmentForm: ["ansettelsesform", "employment", "anställningsform", "type"],
  hourlyRate: ["timelønn", "lønn", "hourly_rate", "timlön", "lön", "lonn"],
  startDate: ["startdato", "start_date", "startdatum", "tiltredelse"],
  positionPct: ["stillingsprosent", "stillingsandel", "prosent", "pct"],
  birthDate: ["fødselsdato", "birth_date", "født", "dob", "födelsedatum"],
  address: ["adresse", "address", "bosted"],
};

/**
 * Auto-match CSV column headers to Smartout fields.
 * Returns a map: csvHeader → fieldKey (or "_skip").
 */
export function autoMatchColumns(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedFields = new Set<string>();

  for (const header of csvHeaders) {
    const normalized = header
      .trim()
      .toLowerCase()
      .replace(/[^a-zæøåäöü0-9_]/g, "");
    let matched = false;

    for (const [fieldKey, synonyms] of Object.entries(SYNONYMS)) {
      if (usedFields.has(fieldKey)) continue;
      if (synonyms.includes(normalized)) {
        mapping[header] = fieldKey;
        usedFields.add(fieldKey);
        matched = true;
        break;
      }
    }

    if (!matched) {
      mapping[header] = "_skip";
    }
  }

  return mapping;
}
