import { describe, expect, it } from "vitest";
import { compendiumIntroduction, compendiumLessons } from "./learningCatalog";

describe("Compendium learning catalog", () => {
  it("keeps the introduction separate from non-blocking orientation tours", () => {
    expect(compendiumIntroduction.length).toBeGreaterThan(0);
    expect(compendiumLessons.length).toBeGreaterThan(0);

    const lessonSteps = compendiumLessons.flatMap((lesson) => lesson.steps);
    expect(lessonSteps.length).toBeGreaterThan(0);
    expect(lessonSteps.every((step) => step.event === undefined)).toBe(true);
    expect(lessonSteps.every((step) => step.section && step.target)).toBe(true);
  });
});
