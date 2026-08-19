export type CompendiumConfig = {
  specVersion: "0.1";
  site?: {
    title?: string;
    description?: string;
    locale?: string;
    baseUrl?: string;
    coverImage?: string;
    logo?: string;
  };
  theme?: { preset?: "midnight" | "parchment" | "ink"; accentColor?: string };
  navigation?: { typeOrder?: string[] };
  publication?: { statuses?: string[]; activeProfileId?: string };
  narrative?: { mode?: "scenes-and-relations" };
};

export type PublicationMode = "all" | "preview";

export type PublicationIdSelection = {
  include: string[];
  exclude: string[];
};

export type PublicationProfile = {
  profileVersion: 1;
  id: string;
  name: string;
  rules: { statuses: string[] };
  selection: {
    entityIds: PublicationIdSelection;
    storyIds: PublicationIdSelection;
    sequenceIds: PublicationIdSelection;
    eventIds: PublicationIdSelection;
  };
  dependencyPolicy: "include-marked";
};

export type PublicationReason = "status" | "manual" | "dependency";

export type PublicationFinding = {
  severity: "warning" | "error";
  message: string;
  id?: string;
};

export type PublicationManifest = {
  profileId: string;
  profileName: string;
  mode: "preview";
  included: {
    entityIds: string[];
    dependencyEntityIds: string[];
    storyIds: string[];
    sequenceIds: string[];
    eventIds: string[];
  };
  excluded: {
    entityIds: string[];
    storyIds: string[];
    sequenceIds: string[];
    eventIds: string[];
  };
  reasons: Record<string, PublicationReason>;
  assets: string[];
  warnings: PublicationFinding[];
  sourceFingerprint: string;
};

export type UniverseIcon = {
  type: "preset" | "image";
  value: string;
};

export type UniverseProfile = {
  name?: string;
  icon?: UniverseIcon;
};

/** A vault file already read into memory (from Node fs or the Tauri backend). */
export type SourceFile = {
  relativePath: string;
  content: string;
  /** Binary vault assets are indexed by path so renderers can resolve them. */
  binary?: boolean;
  modifiedMs?: number;
};

export type EntityPresentation = {
  portrait?: string;
  cover?: string;
};

export type Entity = {
  id: string;
  type: string;
  name: string;
  status: string;
  tags: string[];
  aliases: string[];
  parentId?: string;
  childrenIds: string[];
  path: string;
  body: string;
  wikilinks: string[];
  /** Entity ids this entity's wikilinks resolve to. */
  linkedIds: string[];
  backlinks: string[];
  route: string;
  html: string;
  /** Original Markdown snapshot used by reviewable correction proposals. */
  sourceContent: string;
  modifiedMs?: number;
  /** Optional timeline convention: a single date or a start/end range. */
  date?: string;
  start?: string;
  end?: string;
  /** Optional map-pin convention: id of a Map entity plus 0-100 percent coordinates. */
  map?: string;
  mapX?: number;
  mapY?: number;
  presentation?: EntityPresentation;
};

export type StoryEvent = {
  id: string;
  name: string;
  description?: string;
  text?: string;
  canonRefs: string[];
  /** Vault-relative PathBranching event cover image asset. */
  coverImage?: string;
  /** Additional editorial scene images attached to dialogue beats. */
  images?: string[];
  route: string;
  html: string;
};
export type Story = {
  id: string;
  name: string;
  sequences: Array<{ id: string; name: string; events: StoryEvent[] }>;
  route: string;
};
export type SiteData = {
  vaultPath: string;
  config: CompendiumConfig;
  universeProfile?: UniverseProfile;
  title: string;
  description: string;
  entities: Entity[];
  /** Status values found in entity frontmatter, including unpublished entries. */
  availableStatuses: string[];
  /** Vault-relative binary asset paths indexed during load. */
  assetPaths: string[];
  stories: Story[];
  warnings: string[];
  mode?: PublicationMode;
  publication?: PublicationProfile;
  publicationManifest?: PublicationManifest;
};

export type IndexedUniverse = {
  vaultPath: string;
  config: CompendiumConfig;
  universeProfile?: UniverseProfile;
  title: string;
  description: string;
  entities: Entity[];
  availableStatuses: string[];
  assetPaths: string[];
  stories: Story[];
  warnings: string[];
};
