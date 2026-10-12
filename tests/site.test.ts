import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../src/lib/node/render.js";
import { loadIndexedUniverse, loadSite } from "../src/lib/node/site.js";
import { exportMarkdown } from "../src/lib/node/markdown-export.js";
import { projectIndexedUniverse } from "../src/lib/publications.js";
import type { PublicationProfile } from "../src/types.js";
import { sanitizeNode } from "../src/lib/node/render.js";

const fixture = path.resolve("tests/fixtures/vault");

describe("Compendium source projection", () => {
  it("publishes only canon entities and resolves wikilinks/backlinks", () => {
    const site = loadSite(fixture);
    expect(site.title).toBe("Northwatch Compendium");
    expect(site.availableStatuses).toEqual(["canon", "draft"]);
    expect(site.entities.map((entity) => entity.id)).toEqual([
      "character:aster",
      "character:mira",
      "location:northwatch",
    ]);
    expect(site.entities[2].backlinks).toContain("character:aster");
    expect(site.entities[0].html).toContain("/location/location-northwatch/");
  });

  it("projects editorial PathBranching data and not executable state", () => {
    const site = loadSite(fixture);
    const story = site.stories[0];
    const event = story.sequences[0].events[0];
    expect(event).toMatchObject({
      name: "Arrival at Northwatch",
      canonRefs: ["character:aster", "location:northwatch"],
    });
    expect(JSON.stringify(event)).not.toContain("SECRET DECISION");
    expect(JSON.stringify(event)).not.toContain("hidden");
    expect(site.stories[1].sequences[0].events[0].name).toBe("Legacy scene");
  });

  it("projects safe route choices and diagnoses conditional or broken routes", () => {
    const site = loadSite(fixture);
    const event = site.stories[0].sequences[0].events.find(
      (item) => item.id === "event:arrival",
    )!;
    expect(event.choices).toEqual([
      {
        id: "route:gate",
        label: "Open the northern gate",
        targetEventId: "event:departure",
        targetRoute: "/stories/main/event-departure/",
        destinationName: "Beyond the northern gate",
      },
      {
        id: "route:room",
        label: "Inspect the flooded room",
        targetEventId: "event:private",
        targetRoute: "/stories/main/event-private/",
        destinationName: "Keeper's secret chamber",
      },
    ]);
    expect(site.warnings.join(" ")).toContain("Conditional narrative options");
    expect(site.warnings.join(" ")).toContain("unavailable destination");
    expect(JSON.stringify(event)).not.toContain("private:keeper-key");
    expect(JSON.stringify(event)).not.toContain("Use the keeper's hidden key");
  });

  it("removes choices to excluded events and keeps private text out of the edition", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile: PublicationProfile = {
      profileVersion: 1,
      id: "players",
      name: "Players",
      rules: { statuses: [] },
      selection: {
        entityIds: { include: [], exclude: [] },
        storyIds: { include: ["main"], exclude: [] },
        sequenceIds: { include: ["sequence:one"], exclude: [] },
        eventIds: {
          include: ["event:arrival", "event:departure"],
          exclude: ["event:private"],
        },
      },
      dependencyPolicy: "include-marked",
    };
    const preview = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    const event = preview.stories[0].sequences[0].events.find(
      (item) => item.id === "event:arrival",
    )!;
    expect(event.choices?.map((choice) => choice.targetEventId)).toEqual([
      "event:departure",
    ]);
    expect(JSON.stringify(preview)).not.toContain("GM PRIVATE");
    expect(JSON.stringify(preview)).not.toContain("Keeper's secret chamber");
    expect(JSON.stringify(preview)).not.toContain("Open the GM-only door");
    expect(JSON.stringify(preview)).not.toContain("event:gm-only");
    expect(
      preview.publicationManifest?.warnings
        .map((item) => item.message)
        .join(" "),
    ).toContain("destination is not included");
    const baselineFingerprint = preview.publicationManifest?.sourceFingerprint;
    const privateEvent = indexed.stories
      .flatMap((story) =>
        story.sequences.flatMap((sequence) => sequence.events),
      )
      .find((item) => item.id === "event:private")!;
    privateEvent.name = "An edited hidden scene name";
    privateEvent.text = "GM PRIVATE: a new secret detail.";
    const afterPrivateEdit = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    expect(afterPrivateEdit.publicationManifest?.sourceFingerprint).toBe(
      baselineFingerprint,
    );
  });

  it("projects PathBranching event cover assets without executable state", () => {
    const site = loadSite(fixture);
    const event = site.stories[0].sequences[0].events[0];
    expect(event.coverImage).toBe(".everend/assets/image/arrival.png");
    expect(JSON.stringify(event)).not.toContain("decisions");
  });

  it("removes unsafe HTML while retaining resolved internal links", () => {
    const html = renderMarkdown("<script>alert(1)</script> [[Aster]]", () => ({
      route: "/character/character-aster/",
      label: "Aster Vale",
    }));
    expect(html).not.toContain("script");
    expect(html).toContain("/character/character-aster/");
  });

  it("exports a portable Markdown bundle", () => {
    const output = fs.mkdtempSync(
      path.join(os.tmpdir(), "compendium-markdown-"),
    );
    exportMarkdown(loadSite(fixture), output);
    expect(
      fs.readFileSync(path.join(output, "manifest.json"), "utf8"),
    ).toContain("character:aster");
    expect(
      fs.readFileSync(path.join(output, "stories", "main.md"), "utf8"),
    ).toContain("Arrival at Northwatch");
    fs.rmSync(output, { recursive: true, force: true });
  });

  it("keeps All separate from the active Preview profile", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile: PublicationProfile = {
      profileVersion: 1,
      id: "manual",
      name: "Manual",
      rules: { statuses: [] },
      selection: {
        entityIds: { include: ["character:aster"], exclude: [] },
        storyIds: { include: [], exclude: [] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: [], exclude: [] },
      },
      dependencyPolicy: "include-marked",
    };
    const preview = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    const all = projectIndexedUniverse(indexed, "all", profile, sanitizeNode);
    expect(preview.entities.map((entity) => entity.id)).toEqual([
      "character:aster",
      "character:mira",
      "location:northwatch",
    ]);
    expect(all.entities.map((entity) => entity.id)).toEqual(
      indexed.entities.map((entity) => entity.id),
    );
    expect(all.publicationManifest).toBeUndefined();
    expect(preview.publicationManifest?.mode).toBe("preview");
  });

  it("lets manual selection extend statuses and exclusions win over dependencies", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile: PublicationProfile = {
      profileVersion: 1,
      id: "manual",
      name: "Manual",
      rules: { statuses: [] },
      selection: {
        entityIds: {
          include: ["character:aster"],
          exclude: ["character:mira"],
        },
        storyIds: { include: [], exclude: [] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: [], exclude: [] },
      },
      dependencyPolicy: "include-marked",
    };
    const preview = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    expect(preview.entities.map((entity) => entity.id)).toEqual([
      "character:aster",
      "location:northwatch",
    ]);
    expect(preview.publicationManifest?.included.dependencyEntityIds).toEqual([
      "location:northwatch",
    ]);
    expect(
      preview.warnings.some((warning) =>
        warning.includes("Excluded dependency character:mira"),
      ),
    ).toBe(true);
  });

  it("preserves the minimal story structure for event-level selection", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile: PublicationProfile = {
      profileVersion: 1,
      id: "event-only",
      name: "Event only",
      rules: { statuses: [] },
      selection: {
        entityIds: { include: [], exclude: [] },
        storyIds: { include: [], exclude: [] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: ["event:arrival"], exclude: [] },
      },
      dependencyPolicy: "include-marked",
    };
    const preview = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    expect(preview.stories).toHaveLength(1);
    expect(preview.stories[0].sequences).toHaveLength(1);
    expect(
      preview.stories[0].sequences[0].events.map((event) => event.id),
    ).toEqual(["event:arrival"]);
    expect(preview.entities.map((entity) => entity.id)).toEqual([
      "character:aster",
      "character:mira",
      "location:northwatch",
    ]);
  });

  it("produces a stable ordered manifest", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile = {
      profileVersion: 1 as const,
      id: "stable",
      name: "Stable",
      rules: { statuses: ["canon"] },
      selection: {
        entityIds: { include: [], exclude: [] },
        storyIds: { include: [], exclude: [] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: [], exclude: [] },
      },
      dependencyPolicy: "include-marked" as const,
    } satisfies PublicationProfile;
    const first = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    ).publicationManifest;
    const second = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    ).publicationManifest;
    expect(first).toEqual(second);
    expect(first?.included.entityIds).toEqual(
      [...(first?.included.entityIds ?? [])].sort(),
    );
  });

  it("treats narrative exclusions as filters over the default story set", () => {
    const indexed = loadIndexedUniverse(fixture);
    const profile: PublicationProfile = {
      profileVersion: 1,
      id: "canon-without-main",
      name: "Canon without main",
      rules: { statuses: ["canon"] },
      selection: {
        entityIds: { include: [], exclude: [] },
        storyIds: { include: [], exclude: ["main"] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: [], exclude: [] },
      },
      dependencyPolicy: "include-marked",
    };
    const preview = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeNode,
    );
    expect(preview.stories.map((story) => story.id)).toEqual(["legacy"]);
  });
});
