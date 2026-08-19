import type {
  CompendiumConfig,
  Entity,
  IndexedUniverse,
  PublicationFinding,
  PublicationManifest,
  PublicationMode,
  PublicationProfile,
  SiteData,
  Story,
} from "../types.js";
import { findMarkdownAssets, renderMarkdownWith } from "./markdown.js";
import { resolveVaultAssetPath } from "./assets.js";
import {
  entityLinkResolver,
  projectEntities,
  resolveEntityReference,
} from "./vault.js";
import { stableSlug } from "./paths.js";
import type { Sanitizer } from "./markdown.js";

export const PUBLICATIONS_RELATIVE_DIR = ".everend/.compendium/publications";

const emptySelection = () => ({ include: [], exclude: [] });

export function createDefaultPublicationProfile(
  config: CompendiumConfig,
): PublicationProfile {
  return {
    profileVersion: 1,
    id: "default",
    name: "Default publication",
    rules: { statuses: [...(config.publication?.statuses ?? ["canon"])] },
    selection: {
      entityIds: emptySelection(),
      storyIds: emptySelection(),
      sequenceIds: emptySelection(),
      eventIds: emptySelection(),
    },
    dependencyPolicy: "include-marked",
  };
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          ),
        ),
      ]
    : [];
}

function idSelection(value: unknown) {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const exclude = strings(source.exclude);
  const excluded = new Set(exclude);
  return {
    include: strings(source.include).filter((id) => !excluded.has(id)),
    exclude,
  };
}

export function normalizePublicationProfile(
  value: unknown,
): PublicationProfile {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rules =
    source.rules && typeof source.rules === "object"
      ? (source.rules as Record<string, unknown>)
      : {};
  const selection =
    source.selection && typeof source.selection === "object"
      ? (source.selection as Record<string, unknown>)
      : {};
  const id =
    typeof source.id === "string" && source.id.trim()
      ? stableSlug(source.id)
      : "default";
  const name =
    typeof source.name === "string" && source.name.trim()
      ? source.name.trim()
      : id;
  return {
    profileVersion: 1,
    id,
    name,
    rules: { statuses: strings(rules.statuses) },
    selection: {
      entityIds: idSelection(selection.entityIds),
      storyIds: idSelection(selection.storyIds),
      sequenceIds: idSelection(selection.sequenceIds),
      eventIds: idSelection(selection.eventIds),
    },
    dependencyPolicy: "include-marked",
  };
}

export function parsePublicationProfile(
  source: string,
  label = "publication profile",
) {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new Error(
      `${label} must be valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value || typeof value !== "object")
    throw new Error(`${label} must be an object.`);
  const version = (value as Record<string, unknown>).profileVersion;
  if (version !== 1) throw new Error(`${label} must set profileVersion: 1.`);
  return normalizePublicationProfile(value);
}

export function serializePublicationProfile(profile: PublicationProfile) {
  return `${JSON.stringify(normalizePublicationProfile(profile), null, 2)}\n`;
}

export function publicationRelativePath(id: string) {
  return `${PUBLICATIONS_RELATIVE_DIR}/${stableSlug(id)}.json`;
}

export function loadPublicationProfiles(
  files: Array<{ relativePath: string; content: string }>,
  config: CompendiumConfig,
) {
  const warnings: string[] = [];
  const profiles: PublicationProfile[] = [];
  for (const file of files) {
    const relativePath = file.relativePath.replaceAll("\\", "/");
    if (
      !relativePath.startsWith(`${PUBLICATIONS_RELATIVE_DIR}/`) ||
      !relativePath.endsWith(".json")
    )
      continue;
    try {
      profiles.push(parsePublicationProfile(file.content, relativePath));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  const available = profiles.length
    ? profiles
    : [createDefaultPublicationProfile(config)];
  const activeId = config.publication?.activeProfileId;
  const active =
    available.find((profile) => profile.id === activeId) ?? available[0];
  return { profiles: available, active, warnings };
}

export function profileForId(
  profiles: PublicationProfile[],
  id: string | undefined,
  config: CompendiumConfig,
) {
  return (
    profiles.find((profile) => profile.id === id) ??
    profiles[0] ??
    createDefaultPublicationProfile(config)
  );
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function finding(message: string, id?: string): PublicationFinding {
  return { severity: "warning", message, id };
}

function findStoryParts(
  stories: Story[],
  profile: PublicationProfile,
  mode: PublicationMode,
) {
  const storyIds = new Set<string>();
  const sequenceIds = new Set<string>();
  const eventIds = new Set<string>();
  const excludedStoryIds = new Set(profile.selection.storyIds.exclude);
  const excludedSequenceIds = new Set(profile.selection.sequenceIds.exclude);
  const excludedEventIds = new Set(profile.selection.eventIds.exclude);

  const hasNarrativeInclude = [
    profile.selection.storyIds,
    profile.selection.sequenceIds,
    profile.selection.eventIds,
  ].some((selection) => selection.include.length > 0);
  const shouldIncludeDefaultStories =
    profile.rules.statuses.length > 0 || profile.id === "default";

  if (mode === "all" || (!hasNarrativeInclude && shouldIncludeDefaultStories)) {
    stories.forEach((story) => {
      storyIds.add(story.id);
      story.sequences.forEach((sequence) => {
        sequenceIds.add(sequence.id);
        sequence.events.forEach((event) => eventIds.add(event.id));
      });
    });
  } else {
    const includedStoryIds = new Set(profile.selection.storyIds.include);
    const includedSequenceIds = new Set(profile.selection.sequenceIds.include);
    const includedEventIds = new Set(profile.selection.eventIds.include);

    for (const story of stories) {
      if (includedStoryIds.has(story.id)) storyIds.add(story.id);
      for (const sequence of story.sequences) {
        const sequenceSelected =
          includedStoryIds.has(story.id) ||
          includedSequenceIds.has(sequence.id);
        const eventSelected = sequence.events.some((event) =>
          includedEventIds.has(event.id),
        );
        if (sequenceSelected || eventSelected) sequenceIds.add(sequence.id);
        for (const event of sequence.events) {
          if (sequenceSelected || includedEventIds.has(event.id))
            eventIds.add(event.id);
        }
      }
    }

    for (const story of stories) {
      const hasSelectedPart = story.sequences.some((sequence) =>
        sequenceIds.has(sequence.id),
      );
      if (hasSelectedPart) storyIds.add(story.id);
    }
  }

  for (const id of excludedStoryIds) {
    storyIds.delete(id);
    const story = stories.find((candidate) => candidate.id === id);
    story?.sequences.forEach((sequence) => {
      sequenceIds.delete(sequence.id);
      sequence.events.forEach((event) => eventIds.delete(event.id));
    });
  }
  for (const story of stories) {
    for (const sequence of story.sequences) {
      if (excludedSequenceIds.has(sequence.id)) {
        sequenceIds.delete(sequence.id);
        sequence.events.forEach((event) => eventIds.delete(event.id));
      }
      for (const event of sequence.events) {
        if (excludedEventIds.has(event.id)) eventIds.delete(event.id);
      }
    }
  }
  return {
    storyIds,
    sequenceIds,
    eventIds,
    excludedStoryIds,
    excludedSequenceIds,
    excludedEventIds,
  };
}

function publicationAssets(
  indexed: IndexedUniverse,
  entities: Entity[],
  stories: Story[],
) {
  const assets = new Set<string>();
  [indexed.config.site?.coverImage, indexed.config.site?.logo]
    .filter((value): value is string => Boolean(value))
    .forEach((value) => assets.add(value));
  entities.forEach((entity) => {
    [entity.presentation?.portrait, entity.presentation?.cover]
      .filter((value): value is string => Boolean(value))
      .forEach((value) => assets.add(value));
    findMarkdownAssets(entity.body)
      .map((asset) =>
        resolveVaultAssetPath(indexed.assetPaths, entity.path, asset),
      )
      .filter((value): value is string => Boolean(value))
      .forEach((value) => assets.add(value));
  });
  stories.forEach((story) =>
    story.sequences.forEach((sequence) =>
      sequence.events.forEach((event) => {
        [event.coverImage, ...(event.images ?? [])]
          .filter((value): value is string => Boolean(value))
          .forEach((value) => assets.add(value));
        findMarkdownAssets(event.text ?? "")
          .map((asset) =>
            resolveVaultAssetPath(indexed.assetPaths, undefined, asset),
          )
          .filter((value): value is string => Boolean(value))
          .forEach((value) => assets.add(value));
      }),
    ),
  );
  return [...assets].sort();
}

function warnUnknownNarrativeSelections(
  indexed: IndexedUniverse,
  profile: PublicationProfile,
  warnings: PublicationFinding[],
) {
  const knownStories = new Set(indexed.stories.map((story) => story.id));
  const knownSequences = new Set(
    indexed.stories.flatMap((story) =>
      story.sequences.map((sequence) => sequence.id),
    ),
  );
  const knownEvents = new Set(
    indexed.stories.flatMap((story) =>
      story.sequences.flatMap((sequence) =>
        sequence.events.map((event) => event.id),
      ),
    ),
  );
  const checks: Array<[string, string[], Set<string>]> = [
    [
      "story",
      [
        ...profile.selection.storyIds.include,
        ...profile.selection.storyIds.exclude,
      ],
      knownStories,
    ],
    [
      "sequence",
      [
        ...profile.selection.sequenceIds.include,
        ...profile.selection.sequenceIds.exclude,
      ],
      knownSequences,
    ],
    [
      "event",
      [
        ...profile.selection.eventIds.include,
        ...profile.selection.eventIds.exclude,
      ],
      knownEvents,
    ],
  ];
  checks.forEach(([label, ids, known]) =>
    ids.forEach((id) => {
      if (!known.has(id))
        warnings.push(
          finding(`Profile references unknown ${label} ${id}.`, id),
        );
    }),
  );
}

function warnRouteCollisions(
  indexed: IndexedUniverse,
  warnings: PublicationFinding[],
) {
  const routes = new Map<string, string>();
  const check = (route: string, id: string) => {
    const previous = routes.get(route);
    if (previous && previous !== id) {
      warnings.push(
        finding(`Route collision between ${previous} and ${id}: ${route}`, id),
      );
    } else {
      routes.set(route, id);
    }
  };
  indexed.entities.forEach((entity) => check(entity.route, entity.id));
  indexed.stories.forEach((story) => {
    check(story.route, `story:${story.id}`);
    story.sequences.forEach((sequence) =>
      sequence.events.forEach((event) => check(event.route, event.id)),
    );
  });
}

export function projectIndexedUniverse(
  indexed: IndexedUniverse,
  mode: PublicationMode,
  profile: PublicationProfile,
  sanitize: Sanitizer,
): SiteData {
  const warnings: PublicationFinding[] = indexed.warnings.map((message) =>
    finding(message),
  );
  warnUnknownNarrativeSelections(indexed, profile, warnings);
  warnRouteCollisions(indexed, warnings);
  const includedEntityIds = new Set<string>();
  const dependencyEntityIds = new Set<string>();
  const reasons: Record<string, "status" | "manual" | "dependency"> = {};
  const excludedEntityIds = new Set(profile.selection.entityIds.exclude);
  const entityIds = new Set(indexed.entities.map((entity) => entity.id));

  if (mode === "all") {
    indexed.entities.forEach((entity) => {
      includedEntityIds.add(entity.id);
      reasons[entity.id] = "status";
    });
  } else {
    indexed.entities.forEach((entity) => {
      if (profile.rules.statuses.includes(entity.status)) {
        includedEntityIds.add(entity.id);
        reasons[entity.id] = "status";
      }
    });
    for (const id of profile.selection.entityIds.include) {
      if (!entityIds.has(id))
        warnings.push(finding(`Profile references unknown entity ${id}.`, id));
      else {
        includedEntityIds.add(id);
        reasons[id] = "manual";
      }
    }
    for (const id of excludedEntityIds) {
      if (!entityIds.has(id))
        warnings.push(finding(`Profile references unknown entity ${id}.`, id));
      includedEntityIds.delete(id);
    }
  }

  const parts = findStoryParts(indexed.stories, profile, mode);
  const selectedEvents = new Set<string>();
  indexed.stories.forEach((story) =>
    story.sequences.forEach((sequence) =>
      sequence.events.forEach((event) => {
        if (parts.eventIds.has(event.id)) selectedEvents.add(event.id);
      }),
    ),
  );

  if (mode === "preview") {
    const queue = [...includedEntityIds].flatMap(
      (id) =>
        indexed.entities.find((entity) => entity.id === id)?.wikilinks ?? [],
    );
    indexed.stories.forEach((story) =>
      story.sequences.forEach((sequence) =>
        sequence.events.forEach((event) => {
          if (selectedEvents.has(event.id)) queue.push(...event.canonRefs);
        }),
      ),
    );
    while (queue.length) {
      const target = queue.shift() ?? "";
      const resolved = resolveEntityReference(indexed.entities, target);
      if (!resolved) {
        warnings.push(
          finding(`Could not resolve published reference ${target}.`, target),
        );
        continue;
      }
      if (excludedEntityIds.has(resolved.id)) {
        warnings.push(
          finding(
            `Excluded dependency ${resolved.id} is referenced by published content.`,
            resolved.id,
          ),
        );
        continue;
      }
      if (!includedEntityIds.has(resolved.id)) {
        includedEntityIds.add(resolved.id);
        dependencyEntityIds.add(resolved.id);
        reasons[resolved.id] = "dependency";
        queue.push(...resolved.wikilinks);
      }
    }
  }

  const entities = projectEntities(
    indexed.entities,
    includedEntityIds,
    indexed.assetPaths,
    sanitize,
  );
  const stories = indexed.stories
    .filter((story) => (mode === "all" ? true : parts.storyIds.has(story.id)))
    .map((story) => ({
      ...story,
      sequences: story.sequences
        .filter((sequence) =>
          mode === "all" ? true : parts.sequenceIds.has(sequence.id),
        )
        .map((sequence) => ({
          ...sequence,
          events: sequence.events.filter((event) =>
            mode === "all" ? true : parts.eventIds.has(event.id),
          ),
        }))
        .filter((sequence) => sequence.events.length > 0),
    }))
    .filter((story) => story.sequences.length > 0);
  const resolveLink = entityLinkResolver(entities);
  stories.forEach((story) =>
    story.sequences.forEach((sequence) =>
      sequence.events.forEach((event) => {
        event.html = event.text
          ? renderMarkdownWith(event.text, resolveLink, sanitize, (asset) =>
              resolveVaultAssetPath(indexed.assetPaths, undefined, asset),
            )
          : "";
      }),
    ),
  );

  const assets = publicationAssets(indexed, entities, stories);
  const manifest: PublicationManifest | undefined =
    mode === "preview"
      ? {
          profileId: profile.id,
          profileName: profile.name,
          mode: "preview",
          included: {
            entityIds: [...includedEntityIds].sort(),
            dependencyEntityIds: [...dependencyEntityIds].sort(),
            storyIds: [...parts.storyIds].sort(),
            sequenceIds: [...parts.sequenceIds].sort(),
            eventIds: [...parts.eventIds].sort(),
          },
          excluded: {
            entityIds: [...excludedEntityIds].sort(),
            storyIds: [...parts.excludedStoryIds].sort(),
            sequenceIds: [...parts.excludedSequenceIds].sort(),
            eventIds: [...parts.excludedEventIds].sort(),
          },
          reasons: Object.fromEntries(
            Object.entries(reasons).sort(([left], [right]) =>
              left.localeCompare(right),
            ),
          ),
          assets,
          warnings,
          sourceFingerprint: hashText(
            JSON.stringify({
              config: indexed.config,
              entities: indexed.entities,
              stories: indexed.stories,
            }),
          ),
        }
      : undefined;

  return {
    vaultPath: indexed.vaultPath,
    config: indexed.config,
    universeProfile: indexed.universeProfile,
    title: indexed.title,
    description: indexed.description,
    entities,
    availableStatuses: indexed.availableStatuses,
    assetPaths: indexed.assetPaths,
    stories,
    warnings: warnings.map((item) => item.message),
    mode,
    publication: mode === "preview" ? profile : undefined,
    publicationManifest: manifest,
  };
}
