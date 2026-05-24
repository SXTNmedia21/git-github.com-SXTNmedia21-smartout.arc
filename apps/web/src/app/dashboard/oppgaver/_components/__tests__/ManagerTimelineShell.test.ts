import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SHELL = readFileSync(join(__dirname, "..", "ManagerTimelineShell.tsx"), "utf-8");

describe("ManagerTimelineShell", () => {
  it("declares DomainChatOwnership per ADR-0238", () => {
    expect(SHELL).toMatch(/DomainChatOwnership/);
    expect(SHELL).toMatch(/reason=["']oppgaver/);
  });

  it("uses a CSS grid with topbar/toolbar/body rows", () => {
    expect(SHELL).toMatch(/grid-rows-\[.*60px.*52px.*1fr\]|gridTemplateRows/);
  });

  it("declares 100dvh outer with overflow-hidden", () => {
    expect(SHELL).toMatch(/h-\[100dvh\]|h-full/);
    expect(SHELL).toMatch(/overflow-hidden/);
  });

  it("is a client component", () => {
    expect(SHELL.split("\n")[0]).toMatch(/^["']use client["']/);
  });
});
