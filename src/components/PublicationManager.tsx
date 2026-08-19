import { useEffect, useMemo, useState } from "react";
import {
  projectIndexedUniverse,
  createDefaultPublicationProfile,
} from "../lib/publications";
import { sanitizeDom } from "../lib/sanitize-dom";
import type { IndexedUniverse, PublicationProfile, SiteData } from "../types";

type SelectionKind = "entityIds" | "storyIds" | "sequenceIds" | "eventIds";
type SelectionState = "auto" | "include" | "exclude";

function statusLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function cloneProfile(profile: PublicationProfile): PublicationProfile {
  return JSON.parse(JSON.stringify(profile)) as PublicationProfile;
}

function nextProfileId(profiles: PublicationProfile[], name: string) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "publication";
  const ids = new Set(profiles.map((profile) => profile.id));
  let id = base;
  let suffix = 2;
  while (ids.has(id)) id = `${base}-${suffix++}`;
  return id;
}

function selectionState(
  profile: PublicationProfile,
  kind: SelectionKind,
  id: string,
): SelectionState {
  const selection = profile.selection[kind];
  if (selection.include.includes(id)) return "include";
  if (selection.exclude.includes(id)) return "exclude";
  return "auto";
}

function updateSelection(
  profile: PublicationProfile,
  kind: SelectionKind,
  id: string,
  state: SelectionState,
): PublicationProfile {
  const current = profile.selection[kind];
  const include =
    state === "include"
      ? [...new Set([...current.include.filter((value) => value !== id), id])]
      : current.include.filter((value) => value !== id);
  const exclude =
    state === "exclude"
      ? [...new Set([...current.exclude.filter((value) => value !== id), id])]
      : current.exclude.filter((value) => value !== id);
  return {
    ...profile,
    selection: {
      ...profile.selection,
      [kind]: {
        include:
          state === "exclude"
            ? current.include.filter((value) => value !== id)
            : include,
        exclude:
          state === "include"
            ? current.exclude.filter((value) => value !== id)
            : exclude,
      },
    },
  };
}

function SelectionControl({
  value,
  onChange,
  label,
}: {
  value: SelectionState;
  onChange: (value: SelectionState) => void;
  label: string;
}) {
  return (
    <span
      className={`publication-selection-checks publication-selection-${value}`}
      aria-label={`Publication selection for ${label}`}
    >
      <label title={`Include ${label}`}>
        <input
          type="checkbox"
          checked={value === "include"}
          onChange={(event) =>
            onChange(event.target.checked ? "include" : "auto")
          }
        />
        <span>+</span>
      </label>
      <label title={`Exclude ${label}`}>
        <input
          type="checkbox"
          checked={value === "exclude"}
          onChange={(event) =>
            onChange(event.target.checked ? "exclude" : "auto")
          }
        />
        <span>−</span>
      </label>
    </span>
  );
}

function Summary({ preview }: { preview: SiteData }) {
  const manifest = preview.publicationManifest;
  const dependencyCount = manifest?.included.dependencyEntityIds.length ?? 0;
  const excludedCount = manifest
    ? Object.values(manifest.excluded).flat().length
    : 0;
  const assetWarningCount = preview.warnings.filter((warning) =>
    warning.toLowerCase().includes("asset"),
  ).length;
  const linkWarningCount = preview.warnings.filter(
    (warning) =>
      warning.toLowerCase().includes("reference") ||
      warning.toLowerCase().includes("link"),
  ).length;
  return (
    <div
      className="publication-summary"
      aria-label="Publication preview summary"
    >
      <div>
        <strong>{preview.entities.length}</strong>
        <span>entities</span>
      </div>
      <div>
        <strong>{preview.stories.length}</strong>
        <span>stories</span>
      </div>
      <div>
        <strong>{dependencyCount}</strong>
        <span>dependencies</span>
      </div>
      <div>
        <strong>{excludedCount}</strong>
        <span>excluded</span>
      </div>
      <div>
        <strong>{assetWarningCount}</strong>
        <span>missing assets</span>
      </div>
      <div>
        <strong>{linkWarningCount}</strong>
        <span>broken links</span>
      </div>
      <div>
        <strong>{preview.warnings.length}</strong>
        <span>warnings</span>
      </div>
    </div>
  );
}

function inclusionBadge(
  preview: SiteData,
  profile: PublicationProfile,
  id: string,
) {
  if (profile.selection.entityIds.exclude.includes(id)) return "excluded";
  if (profile.selection.entityIds.include.includes(id)) return "selected";
  const reason = preview.publicationManifest?.reasons[id];
  if (reason === "dependency") return "dependency";
  if (reason === "manual") return "selected";
  if (reason === "status") return "status";
  return "not-included";
}

export function PublicationManager({
  indexed,
  profiles,
  activeProfileId,
  onSave,
  onActivate,
  onDelete,
  onPreview,
}: {
  indexed: IndexedUniverse;
  profiles: PublicationProfile[];
  activeProfileId: string;
  onSave: (profile: PublicationProfile) => Promise<void>;
  onActivate: (profile: PublicationProfile) => Promise<void>;
  onDelete: (profile: PublicationProfile) => Promise<void>;
  onPreview: (profile: PublicationProfile) => void;
}) {
  const active =
    profiles.find((profile) => profile.id === activeProfileId) ??
    profiles[0] ??
    createDefaultPublicationProfile(indexed.config);
  const [draft, setDraft] = useState<PublicationProfile>(() =>
    cloneProfile(active),
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [operationError, setOperationError] = useState("");

  useEffect(() => {
    const next = profiles.find((profile) => profile.id === activeProfileId);
    if (next) setDraft(cloneProfile(next));
  }, [activeProfileId, profiles]);

  const preview = useMemo(
    () => projectIndexedUniverse(indexed, "preview", draft, sanitizeDom),
    [draft, indexed],
  );
  const types = useMemo(
    () => [...new Set(indexed.entities.map((entity) => entity.type))].sort(),
    [indexed.entities],
  );
  const folders = useMemo(
    () =>
      [
        ...new Set(
          indexed.entities
            .map((entity) => entity.path.split("/")[0])
            .filter(Boolean),
        ),
      ].sort(),
    [indexed.entities],
  );
  const tags = useMemo(
    () =>
      [...new Set(indexed.entities.flatMap((entity) => entity.tags))].sort(),
    [indexed.entities],
  );
  const statuses = [
    ...new Set([
      "canon",
      ...indexed.availableStatuses,
      ...draft.rules.statuses,
    ]),
  ];
  const filteredEntities = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return indexed.entities.filter(
      (entity) =>
        (typeFilter === "all" || entity.type === typeFilter) &&
        (folderFilter === "all" ||
          entity.path.split("/")[0] === folderFilter) &&
        (tagFilter === "all" || entity.tags.includes(tagFilter)) &&
        (!needle ||
          `${entity.name} ${entity.id} ${entity.path} ${entity.tags.join(" ")}`
            .toLowerCase()
            .includes(needle)),
    );
  }, [folderFilter, indexed.entities, query, tagFilter, typeFilter]);

  const selectProfile = (profile: PublicationProfile) => {
    setDraft(cloneProfile(profile));
    setQuery("");
    setTypeFilter("all");
    setFolderFilter("all");
    setTagFilter("all");
    setOperationError("");
  };

  const createProfile = () => {
    const name = "New publication";
    setDraft({
      profileVersion: 1,
      id: nextProfileId(profiles, name),
      name,
      rules: { statuses: ["canon"] },
      selection: {
        entityIds: { include: [], exclude: [] },
        storyIds: { include: [], exclude: [] },
        sequenceIds: { include: [], exclude: [] },
        eventIds: { include: [], exclude: [] },
      },
      dependencyPolicy: "include-marked",
    });
  };

  const duplicateProfile = () => {
    const name = `${draft.name} copy`;
    setDraft({
      ...cloneProfile(draft),
      id: nextProfileId(profiles, name),
      name,
    });
  };

  const save = async (activate = false) => {
    setSaving(true);
    setOperationError("");
    try {
      await onSave(draft);
      if (activate) await onActivate(draft);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete publication profile “${draft.name}”?`)
    )
      return;
    setSaving(true);
    setOperationError("");
    try {
      await onDelete(draft);
      const fallback = profiles.find((profile) => profile.id !== draft.id);
      if (fallback) setDraft(cloneProfile(fallback));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const copyExportCommand = async () => {
    const command = `everend-compendium package "${indexed.vaultPath.replaceAll('"', '\\"')}" --profile=${draft.id} --out=compendium-export.zip`;
    try {
      await onSave(draft);
      await navigator.clipboard.writeText(command);
      setOperationError(
        "Export command copied. It will package this profile using Preview.",
      );
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : command);
    }
  };

  return (
    <div className="publication-manager">
      <div className="publication-manager-header">
        <div>
          <span className="settings-kicker">Publication workspace</span>
          <h3>Choose what becomes readable</h3>
          <p>
            Preview is the exact projection that the static exporter will use.
          </p>
        </div>
        <div className="publication-manager-actions">
          <button type="button" onClick={createProfile}>
            New profile
          </button>
          <button type="button" onClick={duplicateProfile}>
            Duplicate
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={() => void save(true)}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      <div
        className="publication-profile-strip"
        role="list"
        aria-label="Publication profiles"
      >
        {profiles.map((profile) => (
          <div role="listitem" key={profile.id}>
            <button
              type="button"
              className={draft.id === profile.id ? "active" : ""}
              onClick={() => selectProfile(profile)}
            >
              <strong>{profile.name}</strong>
              <small>
                {profile.id === activeProfileId ? "Active" : "Saved profile"} ·{" "}
                {profile.id}
              </small>
            </button>
          </div>
        ))}
      </div>

      <div className="publication-manager-fields">
        <label>
          <span>Profile name</span>
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <div className="publication-manager-statuses">
          <span>Statuses included automatically</span>
          <span className="publication-status-list publication-status-list-inline">
            {statuses.map((status) => (
              <label key={status} className="publication-status-option compact">
                <input
                  type="checkbox"
                  checked={draft.rules.statuses.includes(status)}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      rules: {
                        statuses: event.target.checked
                          ? [...new Set([...current.rules.statuses, status])]
                          : current.rules.statuses.filter(
                              (value) => value !== status,
                            ),
                      },
                    }))
                  }
                />
                <span>{statusLabel(status)}</span>
              </label>
            ))}
          </span>
        </div>
        <div className="publication-manager-inline-actions">
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saving || draft.id === activeProfileId}
          >
            Activate
          </button>
          <button
            type="button"
            onClick={() => void remove()}
            disabled={saving || profiles.length <= 1}
          >
            Delete
          </button>
        </div>
      </div>

      <Summary preview={preview} />

      <div className="publication-picker-toolbar">
        <label className="publication-search">
          <span className="visually-hidden">Filter content</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, id, tag or folder…"
          />
        </label>
        <label>
          <span className="visually-hidden">Entity type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {types.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Entity folder</span>
          <select
            value={folderFilter}
            onChange={(event) => setFolderFilter(event.target.value)}
          >
            <option value="all">All folders</option>
            {folders.map((folder) => (
              <option value={folder} key={folder}>
                {folder}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Entity tag</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
          >
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option value={tag} key={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="publication-picker-grid">
        <section className="publication-picker-section">
          <header>
            <h4>Entities</h4>
            <span>{filteredEntities.length} indexed</span>
          </header>
          <div className="publication-picker-list">
            {filteredEntities.map((entity) => {
              const badge = inclusionBadge(preview, draft, entity.id);
              const hasWarning = preview.publicationManifest?.warnings.some(
                (warning) => warning.id === entity.id,
              );
              return (
                <div className="publication-picker-row" key={entity.id}>
                  <div>
                    <strong>{entity.name}</strong>
                    <small>
                      {entity.type} · {statusLabel(entity.status)} ·{" "}
                      {entity.path}
                    </small>
                    <span
                      className={`publication-badge publication-badge-${badge}`}
                    >
                      {badge === "not-included" ? "not included" : badge}
                    </span>
                    {hasWarning ? (
                      <span className="publication-badge publication-badge-warning">
                        warning
                      </span>
                    ) : null}
                  </div>
                  <SelectionControl
                    value={selectionState(draft, "entityIds", entity.id)}
                    onChange={(value) =>
                      setDraft((current) =>
                        updateSelection(current, "entityIds", entity.id, value),
                      )
                    }
                    label={entity.name}
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="publication-picker-section">
          <header>
            <h4>Stories</h4>
            <span>{indexed.stories.length} indexed</span>
          </header>
          <div className="publication-picker-list publication-story-tree">
            {indexed.stories.map((story) => (
              <div key={story.id} className="publication-story-node">
                <div className="publication-picker-row">
                  <div>
                    <strong>{story.name}</strong>
                    <small>Story · {story.id}</small>
                    <span className="publication-badge publication-badge-story">
                      {draft.selection.storyIds.exclude.includes(story.id)
                        ? "excluded"
                        : draft.selection.storyIds.include.includes(story.id)
                          ? "selected"
                          : "automatic"}
                    </span>
                  </div>
                  <SelectionControl
                    value={selectionState(draft, "storyIds", story.id)}
                    onChange={(value) =>
                      setDraft((current) =>
                        updateSelection(current, "storyIds", story.id, value),
                      )
                    }
                    label={story.name}
                  />
                </div>
                {story.sequences.map((sequence) => (
                  <div key={sequence.id} className="publication-story-child">
                    <div className="publication-picker-row">
                      <div>
                        <strong>{sequence.name}</strong>
                        <small>Sequence · {sequence.id}</small>
                        <span className="publication-badge publication-badge-story">
                          {selectionState(draft, "sequenceIds", sequence.id)}
                        </span>
                      </div>
                      <SelectionControl
                        value={selectionState(
                          draft,
                          "sequenceIds",
                          sequence.id,
                        )}
                        onChange={(value) =>
                          setDraft((current) =>
                            updateSelection(
                              current,
                              "sequenceIds",
                              sequence.id,
                              value,
                            ),
                          )
                        }
                        label={sequence.name}
                      />
                    </div>
                    {sequence.events.map((event) => (
                      <div
                        key={event.id}
                        className="publication-story-child publication-story-event"
                      >
                        <div className="publication-picker-row">
                          <div>
                            <strong>{event.name}</strong>
                            <small>Event · {event.id}</small>
                            <span className="publication-badge publication-badge-story">
                              {selectionState(draft, "eventIds", event.id)}
                            </span>
                          </div>
                          <SelectionControl
                            value={selectionState(draft, "eventIds", event.id)}
                            onChange={(value) =>
                              setDraft((current) =>
                                updateSelection(
                                  current,
                                  "eventIds",
                                  event.id,
                                  value,
                                ),
                              )
                            }
                            label={event.name}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>

      {preview.warnings.length > 0 ? (
        <div className="publication-warning-list" role="status">
          <strong>Review before export</strong>
          <ul>
            {preview.warnings.slice(0, 5).map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {operationError ? (
        <div className="publication-warning-list" role="alert">
          {operationError}
        </div>
      ) : null}
      <div className="publication-footer-actions">
        <button type="button" onClick={() => onPreview(draft)}>
          Open Preview
        </button>
        <button type="button" onClick={() => void copyExportCommand()}>
          Export
        </button>
        <small>
          Export always uses Preview. The button copies the reproducible ZIP
          command.
        </small>
      </div>
    </div>
  );
}
