import { isSafeVaultPath } from "./paths.js";

const EXTERNAL_ASSET = /^(?:https?:|data:)/i;

export function isExternalAssetPath(value: string) {
  return EXTERNAL_ASSET.test(value.trim());
}

function normalizeAssetPath(value: string) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function dirname(relativePath: string) {
  const normalized = relativePath.replaceAll("\\", "/");
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

/**
 * Resolves the image-path conventions shared with WorldNotion: exact vault
 * paths, paths relative to the note, then an Obsidian-style basename fallback.
 */
export function resolveVaultAssetPath(
  assetPaths: string[],
  notePath: string | undefined,
  rawPath: string,
) {
  return createVaultAssetPathResolver(assetPaths)(notePath, rawPath);
}

/** Builds an asset resolver once for repeated lookups against the same vault. */
export function createVaultAssetPathResolver(assetPaths: string[]) {
  const known = new Set<string>();
  const firstByBasename = new Map<string, string>();
  for (const assetPath of assetPaths) {
    const normalized = normalizeAssetPath(assetPath);
    known.add(normalized);
    const basename = normalized.split("/").pop();
    if (basename && !firstByBasename.has(basename))
      firstByBasename.set(basename, normalized);
  }

  return (notePath: string | undefined, rawPath: string) => {
    const trimmed = rawPath.trim();
    if (!trimmed || isExternalAssetPath(trimmed)) return undefined;
    let decoded = trimmed;
    try {
      decoded = decodeURI(trimmed);
    } catch {
      // Keep the original value when a malformed escape is present.
    }
    if (!isSafeVaultPath(decoded)) return undefined;

    const normalized = normalizeAssetPath(decoded);
    const candidates = [
      normalized,
      notePath && dirname(notePath)
        ? `${dirname(notePath)}/${normalized}`
        : undefined,
    ].filter((value): value is string => Boolean(value));
    const exact = candidates.find((candidate) => known.has(candidate));
    if (exact) return exact;

    const basename = normalized.split("/").pop();
    if (basename) {
      const fallback = firstByBasename.get(basename);
      if (fallback) return fallback;
    }
    return normalized;
  };
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function propertyDefinitions(config: JsonRecord) {
  const roots = [
    ...(Array.isArray(record(config.baseProperties)?.definitions)
      ? (record(config.baseProperties)?.definitions as unknown[])
      : []),
    ...(Array.isArray(record(config.customFields)?.definitions)
      ? (record(config.customFields)?.definitions as unknown[])
      : []),
  ];
  const paths = new Map<string, string[]>();
  const visit = (definitions: unknown[], parent: string[]) => {
    definitions.forEach((value) => {
      const definition = record(value);
      if (!definition || typeof definition.id !== "string") return;
      const path = [...parent, definition.id];
      paths.set(definition.id, path);
      if (Array.isArray(definition.children)) visit(definition.children, path);
    });
  };
  visit(roots, []);
  return paths;
}

function valueAtPath(value: unknown, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current))
      return undefined;
    current = (current as JsonRecord)[segment];
  }
  return current;
}

/** Reads WorldNotion v3 presentation roles without importing its editor code. */
export function presentationFromProperties(
  propertiesContent: string | undefined,
  entityType: string,
  frontmatter: JsonRecord,
  assetPaths: string[],
  notePath: string,
) {
  return createPresentationResolver(propertiesContent, assetPaths)(
    entityType,
    frontmatter,
    notePath,
  );
}

/** Prepares presentation metadata and asset lookups for a batch of entities. */
export function createPresentationResolver(
  propertiesContent: string | undefined,
  assetPaths: string[],
) {
  if (!propertiesContent) return () => undefined;
  try {
    const config = JSON.parse(propertiesContent) as JsonRecord;
    const types = record(config.entityTypes);
    const definitions = Array.isArray(types?.definitions)
      ? types.definitions
      : [];
    const presentationByType = new Map<string, JsonRecord | undefined>();
    for (const value of definitions) {
      const type = record(value);
      if (typeof type?.id === "string" && !presentationByType.has(type.id))
        presentationByType.set(type.id, record(type.presentation));
    }
    const paths = propertyDefinitions(config);
    const resolveAssetPath = createVaultAssetPathResolver(assetPaths);
    return (entityType: string, frontmatter: JsonRecord, notePath: string) => {
      const presentation = presentationByType.get(entityType);
      if (!presentation) return undefined;
      const result: { portrait?: string; cover?: string } = {};
      for (const role of ["portrait", "cover"] as const) {
        const propertyId = presentation[`${role}PropertyId`];
        if (typeof propertyId !== "string") continue;
        const raw = valueAtPath(
          frontmatter,
          paths.get(propertyId) ?? [propertyId],
        );
        if (typeof raw !== "string" || !raw.trim()) continue;
        const resolved = resolveAssetPath(notePath, raw);
        if (resolved) result[role] = resolved;
      }
      return result.portrait || result.cover ? result : undefined;
    };
  } catch {
    return () => undefined;
  }
}
