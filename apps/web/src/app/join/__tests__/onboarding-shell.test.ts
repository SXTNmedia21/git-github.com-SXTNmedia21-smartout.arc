import { describe, expect, it } from "vitest";
import {
  buildOnboardingShellIntelligence,
  buildPostSignupRedirectPath,
} from "../_lib/onboarding-shell";

describe("buildOnboardingShellIntelligence", () => {
  it("stores join intake as provisional shell data for /onboarding", () => {
    const result = buildOnboardingShellIntelligence({
      step1: {
        email: "owner@example.com",
        companyName: "Nordic Bistro",
        industry: "restaurant",
        city: "Oslo",
        websiteUrl: "https://nordic.example.com",
      },
      step2: {
        firstName: "Ada",
        lastName: "Lovelace",
        street: "Karl Johans gate 1",
        postalCode: "0154",
        city: "Oslo",
        orgNumber: "123456789",
      },
      step3: {
        aboutUs: "Seasonal restaurant in Oslo.",
        ourHistory: "Started in 2020.",
        ourConcept: "Nordic tasting menu.",
      },
      step4: {
        openingHours: [
          { dayOfWeek: 1, isClosed: false, openTime: "09:00", closeTime: "17:00" },
          { dayOfWeek: 2, isClosed: true },
        ],
        phone: "12345678",
        instagram: "https://instagram.com/nordic",
        facebook: "https://facebook.com/nordic",
      },
      step5: {
        restaurantType: "Fine dining",
        cuisineTypes: ["Norsk/Nordisk"],
        priceCategory: "premium",
        menuDescription: "Local seafood menu",
      },
      step6: {
        employeeCount: "12",
        teamInvites: ["chef@example.com"],
      },
      intelligence: {
        cuisine_types: ["nordisk"],
        concept_clues: ["fine dining"],
      },
    });

    expect(result.source_url).toBe("https://nordic.example.com");
    expect(result.scraped).toMatchObject({
      companyName: "Nordic Bistro",
      email: "owner@example.com",
      phone: "12345678",
      summary: "Seasonal restaurant in Oslo.",
    });
    expect(result.brreg).toMatchObject({
      legalName: "Nordic Bistro",
      orgNumber: "123456789",
      naceDescription: "restaurant",
      address: {
        street: "Karl Johans gate 1",
        postalCode: "0154",
        city: "Oslo",
      },
      employeeCount: 12,
    });
    expect(result.join_intake).toMatchObject({
      ownerProfile: {
        firstName: "Ada",
        lastName: "Lovelace",
      },
      businessNarrative: {
        aboutUs: "Seasonal restaurant in Oslo.",
        ourHistory: "Started in 2020.",
        ourConcept: "Nordic tasting menu.",
      },
      menu: {
        restaurantType: "Fine dining",
        cuisineTypes: ["Norsk/Nordisk"],
        priceCategory: "premium",
        menuDescription: "Local seafood menu",
      },
    });
  });
});

describe("buildPostSignupRedirectPath", () => {
  it("routes new signup shells into authenticated onboarding finalization", () => {
    expect(buildPostSignupRedirectPath("workspace-123")).toBe("/onboarding?ws=workspace-123");
  });
});
