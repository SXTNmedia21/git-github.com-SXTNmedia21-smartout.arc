import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const TARGET_FILES = ["TidslinjeTab.tsx", "TidslinjeChipBar.tsx", "TidslinjeRow.tsx"];

describe("TidslinjeTab tree — no client-side mutations (council 2026-05-23)", () => {
  for (const f of TARGET_FILES) {
    it(`${f} contains no useMutation`, async () => {
      const path = resolve(__dirname, "..", f);
      const src = await readFile(path, "utf8");
      expect(src).not.toMatch(/useMutation\b/);
      expect(src).not.toMatch(/\.mutateAsync\b/);
    });
  }
});
