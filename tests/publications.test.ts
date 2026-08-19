import { describe, expect, it } from "vitest";
import {
  loadPublicationProfiles,
  parsePublicationProfile,
  serializePublicationProfile,
} from "../src/lib/publications.js";
import { defaultConfig } from "../src/lib/config.js";
import { parseConfig } from "../src/lib/config.js";
import { siteAssetPath, sitePath } from "../src/lib/site-links.js";
import { assembleIndexedUniverse } from "../src/lib/assemble.js";
import { sanitizeNode } from "../src/lib/node/render.js";
import { parseVaultAppearanceSettings } from "../src/vaultAppearanceSettings.js";

describe("publication profiles", () => {
  it("normalizes and round-trips the profile format", () => {
    const profile = parsePublicationProfile(
      JSON.stringify({
        profileVersion: 1,
        id: "Public Demo",
        name: " Public Demo ",
        rules: { statuses: ["canon", "canon", ""] },
        selection: { entityIds: { include: ["character:aster"], exclude: [] } },
        dependencyPolicy: "include-marked",
      }),
    );
    expect(profile.id).toBe("public-demo");
    expect(profile.name).toBe("Public Demo");
    expect(profile.rules.statuses).toEqual(["canon"]);
    expect(JSON.parse(serializePublicationProfile(profile))).toMatchObject({
      profileVersion: 1,
      id: "public-demo",
      selection: {
        entityIds: { include: ["character:aster"], exclude: [] },
        storyIds: { include: [], exclude: [] },
      },
    });
  });

  it("uses the configured active profile and keeps malformed profiles as warnings", () => {
    const config = {
      ...defaultConfig,
      publication: { statuses: ["canon"], activeProfileId: "manual" },
    };
    const result = loadPublicationProfiles(
      [
        {
          relativePath: ".everend/.compendium/publications/manual.json",
          content: JSON.stringify({
            profileVersion: 1,
            id: "manual",
            name: "Manual",
            rules: { statuses: [] },
            selection: {},
            dependencyPolicy: "include-marked",
          }),
        },
        {
          relativePath: ".everend/.compendium/publications/broken.json",
          content: "not json",
        },
      ],
      config,
    );
    expect(result.active.id).toBe("manual");
    expect(result.profiles.map((profile) => profile.id)).toEqual(["manual"]);
    expect(result.warnings[0]).toContain("broken.json");
  });

  it("keeps generated links portable at the domain root and under a subpath", () => {
    expect(sitePath("/stories/", "https://example.test/")).toBe("/stories/");
    expect(sitePath("/stories/", "https://example.test/compendium/")).toBe(
      "/compendium/stories/",
    );
    expect(
      siteAssetPath(
        ".everend/assets/cover.png",
        "https://example.test/compendium/",
      ),
    ).toBe("/compendium/assets/.everend/assets/cover.png");
  });

  it("loads the legacy YAML config when the current JSON config is absent", () => {
    const indexed = assembleIndexedUniverse(
      "legacy-vault",
      [
        {
          relativePath: ".everend/compendium.yaml",
          content:
            'specVersion: "0.1"\nsite:\n  title: Legacy Vault\npublication:\n  statuses: [canon]\n',
        },
        {
          relativePath: "Characters/Aster.md",
          content:
            "---\nid: character:aster\ntype: character\nname: Aster\nstatus: canon\n---\n",
        },
      ],
      sanitizeNode,
    );
    expect(indexed.title).toBe("Legacy Vault");
    expect(indexed.config.publication?.statuses).toEqual(["canon"]);
  });

  it("does not treat the old appearance-only settings file as site config", () => {
    const appearanceOnly = JSON.stringify({
      version: 1,
      theme: "worldnotion-dark",
      primaryFont: "sans",
    });
    expect(parseConfig(appearanceOnly).specVersion).toBe("0.1");
    expect(
      parseVaultAppearanceSettings([
        {
          relativePath: ".everend/.compendium/settings.json",
          content: appearanceOnly,
        },
      ]),
    ).toMatchObject({ theme: "worldnotion-dark", primaryFont: "sans" });
  });
});
