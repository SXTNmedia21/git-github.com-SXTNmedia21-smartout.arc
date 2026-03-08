import type { IndustryPackage } from "@/lib/industry/types";

// ─── Scraped Data (from onboarding intelligence) ───

export type ScrapedIntelligence = {
  companyName?: string;
  orgNumber?: string;
  industryType?: string;
  openingHours?: string;
  departments?: string[];
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  googleRating?: number;
  menuItemCount?: number;
};

// ─── Document Extraction (from Step 1) ───

export type DocumentExtractionResult = {
  policies?: Array<{ name: string; content: string; source: string }>;
  payroll?: {
    tariff?: string;
    supplements?: Record<string, unknown>;
    source: string;
  };
  employees?: Array<{
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    department?: string;
    position?: string;
    source: string;
  }>;
  shiftPatterns?: Array<{
    name: string;
    startTime: string;
    endTime: string;
    department?: string;
    source: string;
  }>;
  employmentTerms?: {
    noticePeriod?: string;
    probation?: string;
    source: string;
  };
  handbookSections?: Array<{
    chapterKey: string;
    content: string;
    source: string;
  }>;
};

// ─── Wizard-Level State ───

export type SetupWizardState = {
  scrapedData: ScrapedIntelligence;
  extractedData: DocumentExtractionResult;
  industryPackage: IndustryPackage;
  createdPolicyIds: string[];
  payrollSaved: boolean;
  employmentSaved: boolean;
  invitedCount: number;
  shiftTemplateCount: number;
  seasonCreated: boolean;
};

export const EMPTY_EXTRACTION: DocumentExtractionResult = {};
