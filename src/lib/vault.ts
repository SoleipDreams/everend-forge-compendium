import YAML from "yaml";
import type { Entity, SourceFile } from "../types.js";
import { presentationFromProperties, resolveVaultAssetPath } from "./assets.js";
import {
  findWikilinks,
  renderMarkdownWith,
  type LinkResolver,
  type Sanitizer,
} from "./markdown.js";
import { entityRoute } from "./paths.js";

type ParsedDocument = { frontmatter: Record<string, unknown>; body: string };

function parseDocument(source: string): ParsedDocument | undefined {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return undefined;
  const end = normalized.indexOf("\n---", 4);
  if (end < 0) return undefined;
  return {
    frontmatter: YAML.parse(normalized.slice(4, end)) ?? {},
    body: normalized.slice(end + 4).trim(),
  };
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return undefined;
}

function fileBaseName(relativePath: string) {
  const name = relativePath.split("/").pop() ?? relativePath;
  return name.replace(/\.[^.]+$/, "");
}

function lookupKeys(entity: Entity) {
  return [
    entity.id,
    entity.name,
    fileBaseName(entity.path),
    ...entity.aliases,
  ].map((value) => value.trim().toLowerCase());
}

/** True for vault markdown documents the projection should consider. */
function isEntityDocument(relativePath: string) {
  if (!relativePath.endsWith(".md")) return false;
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.startsWith("."))) return false;
  const parentName =
    segments.length > 1 ? segments[segments.length - 2] : undefined;
  if (parentName && segments[segments.length - 1] === `${parentName}.md`)
    return false;
  return true;
}

/** Returns status values from valid entity documents, whether published or not. */
export function discoverEntityStatuses(files: SourceFile[]) {
  const statuses = new Set<string>();
  for (const file of files) {
    const relativePath = file.relativePath.replaceAll("\\", "/");
    if (!isEntityDocument(relativePath)) continue;
    const parsed = parseDocument(file.content);
    const status = parsed?.frontmatter.status;
    if (typeof status === "string" && status.trim())
      statuses.add(status.trim());
  }
  return [...statuses].sort((left, right) => left.localeCompare(right));
}

function readEntities(files: SourceFile[], warnings: string[]): Entity[] {
  const entities: Entity[] = [];
  const propertiesContent = files.find(
    (file) =>
      file.relativePath.replaceAll("\\", "/") === ".everend/properties.json",
  )?.content;
  const seenIds = new Set<string>();
  for (const file of files) {
    const relativePath = file.relativePath.replaceAll("\\", "/");
    if (!isEntityDocument(relativePath)) continue;
    const parsed = parseDocument(file.content);
    if (!parsed) continue;
    const { id, type, name, status } = parsed.frontmatter;
    if (
      typeof id !== "string" ||
      !id.trim() ||
      typeof type !== "string" ||
      !type.trim() ||
      typeof name !== "string" ||
      !name.trim() ||
      typeof status !== "string" ||
      !status.trim()
    ) {
      warnings.push(`${relativePath} is missing required entity frontmatter.`);
      continue;
    }
    if (seenIds.has(id)) {
      warnings.push(`${relativePath} has duplicate entity id ${id}.`);
      continue;
    }
    seenIds.add(id);
    entities.push({
      id,
      type,
      name,
      status,
      tags: asStringList(parsed.frontmatter.tags),
      aliases: asStringList(parsed.frontmatter.aliases),
      parentId:
        typeof parsed.frontmatter.parentId === "string"
          ? parsed.frontmatter.parentId
          : undefined,
      childrenIds: asStringList(parsed.frontmatter.childrenIds),
      path: relativePath,
      body: parsed.body,
      wikilinks: findWikilinks(parsed.body),
      linkedIds: [],
      backlinks: [],
      route: entityRoute(type, id),
      html: "",
      sourceContent: file.content,
      modifiedMs: file.modifiedMs,
      date: asOptionalString(parsed.frontmatter.date),
      start: asOptionalString(parsed.frontmatter.start),
      end: asOptionalString(parsed.frontmatter.end),
      map: asOptionalString(parsed.frontmatter.map),
      mapX: asOptionalNumber(parsed.frontmatter.mapX),
      mapY: asOptionalNumber(parsed.frontmatter.mapY),
      presentation: presentationFromProperties(
        propertiesContent,
        type,
        parsed.frontmatter,
        files
          .filter((candidate) => candidate.binary)
          .map((candidate) => candidate.relativePath.replaceAll("\\", "/")),
        relativePath,
      ),
    });
  }

  return entities.sort((left, right) => left.name.localeCompare(right.name));
}

export function resolveEntityReference(
  entities: Entity[],
  target: string,
): Entity | undefined {
  const normalized = target.trim().toLowerCase();
  return entities.find((entity) => lookupKeys(entity).includes(normalized));
}

function decorateEntities(
  sourceEntities: Entity[],
  assetPaths: string[],
  sanitize: Sanitizer,
): Entity[] {
  const entities: Entity[] = sourceEntities.map((entity) => ({
    ...entity,
    linkedIds: [],
    backlinks: [],
    html: "",
  }));

  const byKey = new Map<string, Entity>();
  entities.forEach((entity) =>
    lookupKeys(entity).forEach((key) => byKey.set(key, entity)),
  );
  entities.forEach((entity) => {
    entity.wikilinks.forEach((target) => {
      const resolved = byKey.get(target.toLowerCase());
      if (resolved) {
        resolved.backlinks.push(entity.id);
        if (!entity.linkedIds.includes(resolved.id)) {
          entity.linkedIds.push(resolved.id);
        }
      }
    });
    entity.html = renderMarkdownWith(
      entity.body,
      (target) => {
        const resolved = byKey.get(target.toLowerCase());
        return resolved
          ? { route: resolved.route, label: resolved.name }
          : undefined;
      },
      sanitize,
      (asset) => resolveVaultAssetPath(assetPaths, entity.path, asset),
    );
  });
  return entities.sort((left, right) => left.name.localeCompare(right.name));
}

/** Indexes every valid entity regardless of its publication status. */
export function indexEntities(
  files: SourceFile[],
  warnings: string[],
  sanitize: Sanitizer,
): Entity[] {
  const assetPaths = files
    .filter((file) => file.binary)
    .map((file) => file.relativePath.replaceAll("\\", "/"));
  return decorateEntities(readEntities(files, warnings), assetPaths, sanitize);
}

/** Projects an indexed entity set into the visible publication subset. */
export function projectEntities(
  indexedEntities: Entity[],
  includedIds: Set<string>,
  assetPaths: string[],
  sanitize: Sanitizer,
): Entity[] {
  return decorateEntities(
    indexedEntities.filter((entity) => includedIds.has(entity.id)),
    assetPaths,
    sanitize,
  );
}

/** Resolver over projected entities, matching id, name, file base, or alias. */
export function entityLinkResolver(entities: Entity[]): LinkResolver {
  const byKey = new Map<string, Entity>();
  entities.forEach((entity) =>
    lookupKeys(entity).forEach((key) => byKey.set(key, entity)),
  );
  return (target) => {
    const resolved = byKey.get(target.toLowerCase());
    return resolved
      ? { route: resolved.route, label: resolved.name }
      : undefined;
  };
}
