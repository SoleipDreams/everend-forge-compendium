import type { SourceFile, Story, StoryChoice, StoryEvent } from "../types.js";
import { eventRoute, stableSlug, storyRoute } from "./paths.js";

type Json = Record<string, unknown>;
type Asset = { id: string; path: string; kind?: string };
type RawEvent = { id: string; name: string; source: Json };

const PB_ROOT = ".everend/.pathbranching";

const list = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
const record = (value: unknown): Json | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : undefined;
const valueString = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const pbSlug = (value: string) => stableSlug(value);

function eventFrom(
  value: Json,
  storyId: string,
  assets: Map<string, string> = new Map(),
): StoryEvent | undefined {
  const event = record(value.event) ?? value;
  const id = valueString(event.id);
  const name = valueString(event.name);
  if (!id || !name) return undefined;
  const text = record(event.text);
  const cover = record(event.coverImage);
  const coverAssetId = cover && valueString(cover.assetId);
  const imagePaths = new Set<string>();
  if (coverAssetId && assets.has(coverAssetId)) {
    imagePaths.add(assets.get(coverAssetId)!);
  }
  const collectBeatImages = (value: unknown) => {
    const beat = record(value);
    const sceneImage = record(beat?.sceneImage);
    const assetId = sceneImage && valueString(sceneImage.assetId);
    const assetPath = assetId ? assets.get(assetId) : undefined;
    if (assetPath) imagePaths.add(assetPath);
  };
  (Array.isArray(event.dialogueBeats) ? event.dialogueBeats : []).forEach(
    collectBeatImages,
  );
  (Array.isArray(event.dialogues) ? event.dialogues : []).forEach((value) => {
    const dialogue = record(value);
    (Array.isArray(dialogue?.beats) ? dialogue.beats : []).forEach(
      collectBeatImages,
    );
  });
  return {
    id,
    name,
    description: valueString(event.description),
    text: text ? valueString(text.content) : undefined,
    canonRefs: list(event.canonRefs),
    coverImage: coverAssetId ? assets.get(coverAssetId) : undefined,
    images: imagePaths.size ? [...imagePaths] : undefined,
    route: eventRoute(storyId, id),
    html: "",
  };
}

function hasCondition(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function requiresRuleEvaluation(value: Json) {
  const logic = record(value.logic);
  return (
    value.mode === "conditional" ||
    value.mode === "fallback" ||
    hasCondition(value.conditions) ||
    hasCondition(value.availability) ||
    hasCondition(logic?.when)
  );
}

function storyNodeIds(events: RawEvent[]) {
  const ids = new Set<string>();
  for (const { id, source } of events) {
    ids.add(id);
    for (const decisionValue of Array.isArray(source.decisions)
      ? source.decisions
      : []) {
      const decision = record(decisionValue);
      if (!decision) continue;
      const decisionId = valueString(decision.id);
      if (!decisionId) continue;
      ids.add(`decision:${id}:${decisionId}`);
      for (const outcomeValue of Array.isArray(decision.outcomes)
        ? decision.outcomes
        : []) {
        const outcome = record(outcomeValue);
        const outcomeId = outcome && valueString(outcome.id);
        if (outcomeId) ids.add(`outcome:${id}:${decisionId}:${outcomeId}`);
      }
    }
    for (const dialogueValue of Array.isArray(source.dialogues)
      ? source.dialogues
      : []) {
      const dialogue = record(dialogueValue);
      const dialogueId = dialogue && valueString(dialogue.id);
      if (!dialogueId) continue;
      ids.add(`dialogue:${id}:${dialogueId}`);
      for (const beatValue of Array.isArray(dialogue?.beats)
        ? dialogue.beats
        : []) {
        const beat = record(beatValue);
        const beatId = beat && valueString(beat.id);
        if (beatId) ids.add(`beat:${id}:${dialogueId}:${beatId}`);
      }
    }
    for (const beatValue of Array.isArray(source.dialogueBeats)
      ? source.dialogueBeats
      : []) {
      const beat = record(beatValue);
      const beatId = beat && valueString(beat.id);
      if (beatId) ids.add(`beat:${id}:${beatId}`);
    }
  }
  return ids;
}

function projectChoices(
  event: RawEvent,
  destinations: Map<string, { name: string; route: string; source: Json }>,
  knownNodes: Set<string>,
  warnings: string[],
): StoryChoice[] {
  const outcomeLabels = new Map<
    string,
    { label: string; conditional: boolean }
  >();
  for (const decisionValue of Array.isArray(event.source.decisions)
    ? event.source.decisions
    : []) {
    const decision = record(decisionValue);
    const decisionId = decision && valueString(decision.id);
    if (!decision || !decisionId) continue;
    for (const outcomeValue of Array.isArray(decision.outcomes)
      ? decision.outcomes
      : []) {
      const outcome = record(outcomeValue);
      const outcomeId = outcome && valueString(outcome.id);
      if (!outcome || !outcomeId) continue;
      outcomeLabels.set(`outcome:${event.id}:${decisionId}:${outcomeId}`, {
        label: (
          valueString(outcome.visibleText) ??
          valueString(outcome.name) ??
          ""
        ).trim(),
        conditional:
          requiresRuleEvaluation(decision) || requiresRuleEvaluation(outcome),
      });
    }
  }

  const transitions = (
    Array.isArray(event.source.transitions) ? event.source.transitions : []
  )
    .map((value) => record(value))
    .filter((value): value is Json => Boolean(value));
  const candidates = transitions.flatMap((transition) => {
    const from = valueString(transition.from);
    if (from !== event.id && !outcomeLabels.has(from ?? "")) return [];
    const to = valueString(transition.to);
    if (!to || (knownNodes.has(to) && !destinations.has(to))) return [];
    return [{ transition, from: from ?? "", to }];
  });
  const choices: StoryChoice[] = [];
  const reported = new Set<string>();
  const diagnose = (message: string) => {
    if (reported.has(message)) return;
    reported.add(message);
    warnings.push(message);
  };

  for (const { transition, from, to } of candidates) {
    const destination = destinations.get(to);
    const outcome = outcomeLabels.get(from);
    if (
      requiresRuleEvaluation(transition) ||
      outcome?.conditional ||
      (destination && requiresRuleEvaluation(destination.source))
    ) {
      diagnose(
        "Conditional narrative options were omitted because Compendium does not evaluate story rules.",
      );
      continue;
    }
    if (!destination) {
      diagnose(
        "A narrative option points to a missing destination and was omitted.",
      );
      continue;
    }
    const transitionId = valueString(transition.id);
    const transitionLabel = valueString(transition.label)?.trim();
    const directLabelledRoute =
      from === event.id &&
      (transition.role === "route" || Boolean(transitionLabel));
    const directAlternatives = candidates.filter(
      (candidate) => candidate.from === event.id,
    ).length;
    if (from === event.id && !directLabelledRoute && directAlternatives < 2)
      continue;
    choices.push({
      id: transitionId || `${event.id}:${from}:${to}`,
      label: transitionLabel || outcome?.label || destination.name,
      targetEventId: to,
      targetRoute: destination.route,
      destinationName: destination.name,
    });
  }
  return choices;
}

function legacyStory(
  value: Json,
  id: string,
  name: string,
  warnings: string[],
): Story {
  const rows = (Array.isArray(value.events) ? value.events : [])
    .map((item) => record(item))
    .filter((item): item is Json => Boolean(item))
    .flatMap((source) => {
      const event = record(source.event) ?? source;
      const eventId = valueString(event.id);
      const eventName = valueString(event.name);
      const projected = eventFrom(source, id);
      return eventId && eventName && projected
        ? [
            {
              event: projected,
              raw: { id: eventId, name: eventName, source: event },
            },
          ]
        : [];
    });
  const destinations = new Map(
    rows.map(({ raw }) => [
      raw.id,
      {
        name: raw.name,
        route: eventRoute(id, raw.id),
        source: raw.source,
      },
    ]),
  );
  const knownNodes = storyNodeIds(rows.map(({ raw }) => raw));
  const events: StoryEvent[] = rows.map(({ event, raw }) => ({
    ...event,
    choices: projectChoices(raw, destinations, knownNodes, warnings),
  }));
  return {
    id,
    name: valueString(value.name) ?? name,
    route: storyRoute(id),
    sequences: [{ id: "legacy", name: "Scenes", events }],
  };
}

export function projectStories(
  files: SourceFile[],
  warnings: string[],
): Story[] {
  const byPath = new Map<string, string>();
  for (const file of files) {
    byPath.set(file.relativePath.replaceAll("\\", "/"), file.content);
  }
  const readJson = (relativePath: string): Json | undefined => {
    const content = byPath.get(relativePath);
    if (content === undefined) return undefined;
    try {
      return JSON.parse(content) as Json;
    } catch {
      return undefined;
    }
  };

  const manifest = readJson(`${PB_ROOT}/manifest.json`);
  const entries = Array.isArray(manifest?.stories) ? manifest.stories : [];
  const stories: Story[] = [];
  for (const entryValue of entries) {
    const entry = record(entryValue);
    const id = entry && valueString(entry.id);
    const name = entry && valueString(entry.name);
    const relative = entry && valueString(entry.path);
    if (!id || !name || !relative || relative.includes("..")) {
      warnings.push("Ignored an invalid PathBranching story manifest entry.");
      continue;
    }
    const saved = readJson(relative.replaceAll("\\", "/"));
    if (!saved) {
      warnings.push(`Could not read PathBranching story ${name}.`);
      continue;
    }
    const assets = new Map(
      (Array.isArray(saved.assets) ? saved.assets : [])
        .map((item) => record(item))
        .filter((item): item is Json => Boolean(item))
        .flatMap((item) => {
          const asset: Asset = {
            id: valueString(item.id) ?? "",
            path: valueString(item.path) ?? "",
            kind: valueString(item.kind),
          };
          return asset.id && asset.path && asset.kind === "image"
            ? [[asset.id, asset.path] as const]
            : [];
        }),
    );
    if (relative.endsWith(".pathbranching.json")) {
      stories.push(legacyStory(saved, id, name, warnings));
      continue;
    }
    const sequenceRows = list(saved.sequenceIds).flatMap((sequenceId) => {
      const sequenceFile = `${PB_ROOT}/stories/${pbSlug(id)}/sequences/${pbSlug(sequenceId)}/sequence.json`;
      const sequenceSource = readJson(sequenceFile);
      const sequence = sequenceSource
        ? (record(sequenceSource.sequence) ?? sequenceSource)
        : undefined;
      if (!sequence) {
        warnings.push(`Could not read sequence ${sequenceId} in ${name}.`);
        return [];
      }
      const eventIds = list(sequence.eventIds);
      const events = eventIds.flatMap((eventId) => {
        const eventFile = `${PB_ROOT}/stories/${pbSlug(id)}/sequences/${pbSlug(sequenceId)}/events/${pbSlug(eventId)}.json`;
        const savedEvent = readJson(eventFile);
        const source = savedEvent && (record(savedEvent.event) ?? savedEvent);
        const rawId = source && valueString(source.id);
        const rawName = source && valueString(source.name);
        if (!savedEvent || !source || !rawId || !rawName) return [];
        const projected = eventFrom(savedEvent, id, assets);
        return projected
          ? [{ event: projected, raw: { id: rawId, name: rawName, source } }]
          : [];
      });
      return [
        {
          id: sequenceId,
          name: valueString(sequence.name) ?? sequenceId,
          rows: events,
        },
      ];
    });
    const rawEvents = sequenceRows.flatMap((sequence) =>
      sequence.rows.map((row) => row.raw),
    );
    const destinations = new Map(
      rawEvents.map((event) => [
        event.id,
        {
          name: event.name,
          route: eventRoute(id, event.id),
          source: event.source,
        },
      ]),
    );
    const knownNodes = storyNodeIds(rawEvents);
    const sequences = sequenceRows.map((sequence) => ({
      id: sequence.id,
      name: sequence.name,
      events: sequence.rows.map(({ event, raw }) => ({
        ...event,
        choices: projectChoices(raw, destinations, knownNodes, warnings),
      })),
    }));
    stories.push({
      id,
      name: valueString(saved.name) ?? name,
      route: storyRoute(id),
      sequences,
    });
  }
  return stories;
}
