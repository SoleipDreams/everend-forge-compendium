import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IndexedUniverse, PublicationMode, PublicationProfile, SiteData } from "../../types.js";
import { assembleIndexedUniverse } from "../assemble.js";
import { resolveVaultAssetPath } from "../assets.js";
import { CONFIG_RELATIVE_PATH } from "../config.js";
import { findMarkdownAssets } from "../markdown.js";
import { isSafeVaultPath } from "../paths.js";
import {
  loadPublicationProfiles,
  profileForId,
  projectIndexedUniverse,
} from "../publications.js";
import { walkVaultFiles } from "./fs-source.js";
import { sanitizeNode } from "./render.js";
import { sitePath } from "../site-links.js";

export function configPath(vaultPath: string) {
  return path.join(vaultPath, ...CONFIG_RELATIVE_PATH.split("/"));
}

export function loadSite(vaultPathInput: string): SiteData {
  return loadSiteWithOptions(vaultPathInput);
}

export function loadIndexedUniverse(vaultPathInput: string): IndexedUniverse {
  const vaultPath = path.resolve(vaultPathInput);
  if (!fs.statSync(vaultPath).isDirectory())
    throw new Error(`${vaultPath} is not a vault directory.`);
  return assembleIndexedUniverse(vaultPath, walkVaultFiles(vaultPath), sanitizeNode);
}

export function loadSiteWithOptions(
  vaultPathInput: string,
  options: { profile?: PublicationProfile; profileId?: string; mode?: PublicationMode } = {},
): SiteData {
  const vaultPath = path.resolve(vaultPathInput);
  if (!fs.statSync(vaultPath).isDirectory())
    throw new Error(`${vaultPath} is not a vault directory.`);
  const files = walkVaultFiles(vaultPath);
  const indexed = assembleIndexedUniverse(vaultPath, files, sanitizeNode);
  const loaded = loadPublicationProfiles(files, indexed.config);
  const profile = options.profile ?? profileForId(loaded.profiles, options.profileId, indexed.config);
  return projectIndexedUniverse(indexed, options.mode ?? "preview", profile, sanitizeNode);
}

export function createSiteDataFile(data: SiteData) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "everend-compendium-"),
  );
  const file = path.join(directory, "site-data.json");
  fs.writeFileSync(file, JSON.stringify(data), "utf8");
  return {
    file,
    dispose: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
}

export function copyReferencedAssets(data: SiteData, outputPath: string) {
  const assets = new Set(
    data.publicationManifest?.assets ??
    [
      data.config.site?.coverImage,
      data.config.site?.logo,
      ...data.entities.flatMap((entity) => [
        entity.presentation?.portrait,
        entity.presentation?.cover,
        ...findMarkdownAssets(entity.body).map((asset) =>
          resolveVaultAssetPath(data.assetPaths, entity.path, asset),
        ),
      ]),
      ...data.stories.flatMap((story) =>
        story.sequences.flatMap((sequence) => [
          ...sequence.events.map((event) => event.coverImage),
          ...sequence.events.flatMap((event) => event.images ?? []),
        ]),
      ),
    ].filter((value): value is string => Boolean(value)),
  );
  for (const asset of assets) {
    if (!isSafeVaultPath(asset))
      throw new Error(`Refusing unsafe configured asset path: ${asset}`);
    const source = path.join(data.vaultPath, asset);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      const message = `Referenced asset was not found: ${asset}`;
      data.warnings.push(message);
      if (data.publicationManifest) {
        data.publicationManifest.warnings.push({ severity: "warning", message });
      }
      continue;
    }
    const target = path.join(outputPath, "assets", asset);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
}

export function writePublicationManifest(data: SiteData, outputPath: string) {
  if (!data.publicationManifest) return;
  fs.writeFileSync(
    path.join(outputPath, "publication-manifest.json"),
    `${JSON.stringify(data.publicationManifest, null, 2)}\n`,
    "utf8",
  );
}

/** Prefixes generated Markdown links and assets for static hosting under a subpath. */
export function applySiteBasePath(data: SiteData) {
  const baseUrl = data.config.site?.baseUrl;
  if (!baseUrl) return data;
  const rewrite = (html: string) =>
    html.replace(/(href|src)=("|')\/(?!\/)/g, (_full, attribute: string, quote: string) =>
      `${attribute}=${quote}${sitePath("/", baseUrl).replace(/\/$/, "")}/`,
    );
  data.entities.forEach((entity) => {
    entity.html = rewrite(entity.html);
  });
  data.stories.forEach((story) => story.sequences.forEach((sequence) => sequence.events.forEach((event) => {
    event.html = rewrite(event.html);
  })));
  return data;
}
