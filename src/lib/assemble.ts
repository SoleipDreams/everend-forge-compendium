import type {
  IndexedUniverse,
  PublicationMode,
  PublicationProfile,
  SiteData,
  SourceFile,
  UniverseIcon,
  UniverseProfile,
} from "../types.js";
import { CONFIG_RELATIVE_PATH, parseConfig } from "./config.js";
import { type Sanitizer } from "./markdown.js";
import { projectStories } from "./pathbranching.js";
import {
  discoverEntityStatuses,
  indexEntities,
} from "./vault.js";
import { projectIndexedUniverse } from "./publications.js";

function vaultBaseName(vaultPath: string) {
  const trimmed = vaultPath.replaceAll("\\", "/").replace(/\/+$/, "");
  return trimmed.split("/").pop() || trimmed;
}

function parseUniverseProfile(
  files: SourceFile[],
): UniverseProfile | undefined {
  const profileFile = files.find(
    (file) =>
      file.relativePath.replaceAll("\\", "/") === ".everend/universe.json",
  );
  if (!profileFile) return undefined;

  try {
    const parsed = JSON.parse(profileFile.content) as UniverseProfile | null;
    if (!parsed || typeof parsed !== "object") return undefined;
    const icon: UniverseIcon | undefined =
      parsed.icon?.type && parsed.icon.value
        ? {
            type: parsed.icon.type === "image" ? "image" : "preset",
            value: String(parsed.icon.value),
          }
        : undefined;
    return {
      name:
        typeof parsed.name === "string" && parsed.name.trim()
          ? parsed.name.trim()
          : undefined,
      icon,
    };
  } catch {
    return undefined;
  }
}

/**
 * Pure assembly of the whole Compendium projection from in-memory files.
 * Both the Node CLI (fs walk + sanitize-html) and the desktop app
 * (Tauri index_vault + DOMPurify) call this single entry point.
 */
export function assembleIndexedUniverse(
  vaultPath: string,
  files: SourceFile[],
  sanitize: Sanitizer,
): IndexedUniverse {
  const normalizedFiles = files.map((file) => ({
    ...file,
    relativePath: file.relativePath.replaceAll("\\", "/"),
  }));
  const configFile = normalizedFiles.find(
    (file) => file.relativePath === CONFIG_RELATIVE_PATH,
  ) ?? normalizedFiles.find(
    (file) => file.relativePath === ".everend/compendium.yaml",
  );
  const config = parseConfig(configFile?.content, configFile?.relativePath);
  const universeProfile = parseUniverseProfile(files);
  const availableStatuses = discoverEntityStatuses(files);
  const warnings: string[] = [];
  const assetPaths = files
    .filter((file) => file.binary)
    .map((file) => file.relativePath.replaceAll("\\", "/"));
  const entities = indexEntities(files, warnings, sanitize);
  const stories = projectStories(files, warnings);

  const title = config.site?.title ?? vaultBaseName(vaultPath);
  return {
    vaultPath,
    config,
    universeProfile,
    title,
    description: config.site?.description ?? `A public guide to ${title}.`,
    entities,
    availableStatuses,
    assetPaths,
    stories,
    warnings,
  };
}

export function assembleSiteData(
  vaultPath: string,
  files: SourceFile[],
  sanitize: Sanitizer,
  options: { mode?: PublicationMode; profile?: PublicationProfile } = {},
): SiteData {
  const indexed = assembleIndexedUniverse(vaultPath, files, sanitize);
  const profile = options.profile ?? {
    profileVersion: 1 as const,
    id: "default",
    name: "Default publication",
    rules: { statuses: indexed.config.publication?.statuses ?? ["canon"] },
    selection: {
      entityIds: { include: [], exclude: [] },
      storyIds: { include: [], exclude: [] },
      sequenceIds: { include: [], exclude: [] },
      eventIds: { include: [], exclude: [] },
    },
    dependencyPolicy: "include-marked" as const,
  };
  return projectIndexedUniverse(indexed, options.mode ?? "preview", profile, sanitize);
}
