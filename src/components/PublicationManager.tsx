import { useNotificationMessage, useNotify } from "../notifications";
import { useCompendiumDiagnosticText } from "./compendiumPresentation";
import { useEffect, useId, useMemo, useState } from "react";
import { CompendiumGroup, useCompendiumText } from "./compendiumPresentation";
import { useDialogFocus } from "../useDialogFocus";
import {
  projectIndexedUniverse,
  createDefaultPublicationProfile,
} from "../lib/publications";
import { sanitizeDom } from "../lib/sanitize-dom";
import type { IndexedUniverse, PublicationProfile, SiteData } from "../types";
import {
  useUniverseSwitchGuard,
  type RegisterUniverseSwitchGuard,
} from "../useUniverseSwitchGuard";

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
  const t = useCompendiumText();
  return (
    <span
      className={`publication-selection-checks publication-selection-${value}`}
      aria-label={`${t("Publication selection for", "Selección de publicación para")} ${label}`}
    >
      <label title={`${t("Include", "Incluir")} ${label}`}>
        <input
          type="checkbox"
          aria-label={`${t("Include", "Incluir")} ${label}`}
          checked={value === "include"}
          onChange={(event) =>
            onChange(event.target.checked ? "include" : "auto")
          }
        />
        <span>+</span>
      </label>
      <label title={`${t("Exclude", "Excluir")} ${label}`}>
        <input
          type="checkbox"
          aria-label={`${t("Exclude", "Excluir")} ${label}`}
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
  const t = useCompendiumText();
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
      aria-label={t(
        "Publication preview summary",
        "Resumen de vista previa de publicación",
      )}
    >
      <div>
        <strong>{preview.entities.length}</strong>
        <span>{t("entities", "fichas")}</span>
      </div>
      <div>
        <strong>{preview.stories.length}</strong>
        <span>{t("stories", "historias")}</span>
      </div>
      <div>
        <strong>{dependencyCount}</strong>
        <span>{t("dependencies", "dependencias")}</span>
      </div>
      <div>
        <strong>{excludedCount}</strong>
        <span>{t("excluded", "excluidos")}</span>
      </div>
      <div>
        <strong>{assetWarningCount}</strong>
        <span>{t("missing assets", "archivos ausentes")}</span>
      </div>
      <div>
        <strong>{linkWarningCount}</strong>
        <span>{t("broken links", "enlaces rotos")}</span>
      </div>
      <div>
        <strong>{preview.warnings.length}</strong>
        <span>{t("warnings", "avisos")}</span>
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
  registerUniverseSwitchGuard,
  onLearningAction,
}: {
  onLearningAction?: (event: string) => void;
  indexed: IndexedUniverse;
  profiles: PublicationProfile[];
  activeProfileId: string;
  onSave: (profile: PublicationProfile) => Promise<void>;
  onActivate: (profile: PublicationProfile) => Promise<void>;
  onDelete: (profile: PublicationProfile) => Promise<void>;
  onPreview: (profile: PublicationProfile) => void;
  registerUniverseSwitchGuard?: RegisterUniverseSwitchGuard;
}) {
  const t = useCompendiumText();
  const diagnosticText = useCompendiumDiagnosticText();
  const promptTitle = useId();
  const [pendingTransition, setPendingTransition] = useState<
    (() => void) | undefined
  >();
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
  const [operationNotice, setOperationNotice] = useState("");
  const notify = useNotify();
  useNotificationMessage(operationNotice, "success");
  useNotificationMessage(operationError ? diagnosticText(operationError) : undefined, "error");
  const dialogRef = useDialogFocus({
    visible: !!pendingTransition,
    canClose: !saving,
    onClose: () => setPendingTransition(undefined),
  });
  const requestTransition = (next: () => void) => {
    if (saving) return;
    if (dirty) setPendingTransition(() => next);
    else next();
  };
  const savedDraft = profiles.find((profile) => profile.id === draft.id);
  const dirty =
    !savedDraft || JSON.stringify(savedDraft) !== JSON.stringify(draft);
  useUniverseSwitchGuard(registerUniverseSwitchGuard, dirty || saving);

  useEffect(() => {
    const next = profiles.find((profile) => profile.id === activeProfileId);
    if (next) setDraft(cloneProfile(next));
  }, [activeProfileId]);

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

  const selectionLabel = (value: string) =>
    ({
      auto: t("automatic", "automático"),
      include: t("included", "incluido"),
      exclude: t("excluded", "excluido"),
      selected: t("selected", "seleccionado"),
      dependency: t("dependency", "dependencia"),
      status: t("status", "estado"),
      excluded: t("excluded", "excluido"),
    })[value as "auto"] ?? value;
  const selectProfile = (profile: PublicationProfile) => {
    setDraft(cloneProfile(profile));
    setQuery("");
    setTypeFilter("all");
    setFolderFilter("all");
    setTagFilter("all");
    setOperationError("");
    setOperationNotice("");
  };

  const createProfile = () => {
    const name = t("New publication", "Nueva publicación");
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
    const name = `${draft.name} ${t("copy", "copia")}`;
    setDraft({
      ...cloneProfile(draft),
      id: nextProfileId(profiles, name),
      name,
    });
  };

  const save = async (activate = false) => {
    setSaving(true);
    setOperationError("");
    setOperationNotice("");
    try {
      const original = profiles.find(profile => profile.id === draft.id);
      const selectionChanged = JSON.stringify(original?.selection) !== JSON.stringify(draft.selection);
      await onSave(draft);
      onLearningAction?.("profile-saved");
      if (selectionChanged) onLearningAction?.("selection-saved");
      if (activate) await onActivate(draft);
      notify({ message: activate ? t("Publication saved and activated.", "Publicación guardada y activada.") : t("Publication saved.", "Publicación guardada."), kind: "success" });
      return true;
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        t(
          `Delete publication profile “${draft.name}”?`,
          `¿Eliminar el perfil de publicación «${draft.name}»?`,
        ),
      )
    )
      return;
    setSaving(true);
    setOperationError("");
    setOperationNotice("");
    try {
      await onDelete(draft);
      const fallback = profiles.find((profile) => profile.id !== draft.id);
      if (fallback) setDraft(cloneProfile(fallback));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const copyExportCommand = async () => {
    setSaving(true);
    setOperationError("");
    setOperationNotice("");
    const command = `everend-compendium package "${indexed.vaultPath.replaceAll('"', '\\"')}" --profile=${draft.id} --out=compendium-export.zip`;
    try {
      await onSave(draft);
      await navigator.clipboard.writeText(command);
      onLearningAction?.("zip-command-copied");
      setOperationNotice(
        t(
          "ZIP command copied. It will package this profile using Preview.",
          "Comando ZIP copiado. Generará el paquete de este perfil mediante la vista previa.",
        ),
      );
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : command);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <fieldset className="publication-manager" disabled={saving}>
        <p className="publication-draft-status" role="status">
          {dirty
            ? t("Unsaved profile changes", "Cambios del perfil sin guardar")
            : t("Profile saved", "Perfil guardado")}
        </p>
        <div className="publication-manager-header">
          <div className="publication-manager-actions">
            <button
              type="button"
              onClick={() => requestTransition(createProfile)}
            >
              {t("New profile", "Nuevo perfil")}{" "}
            </button>
            <button
              type="button"
              onClick={() => requestTransition(duplicateProfile)}
            >
              {t("Duplicate", "Duplicar")}{" "}
            </button>
            <button
              type="button"
              className="primary-action"
              onClick={() => void save(true)}
              disabled={saving}
            >
              {saving
                ? t("Saving…", "Guardando…")
                : t("Save and activate", "Guardar y activar")}
            </button>
          </div>
        </div>

        <div
          className="publication-profile-strip"
          role="list"
          aria-label={t("Publication profiles", "Perfiles de publicación")}
        >
          {profiles.map((profile) => (
            <div role="listitem" key={profile.id}>
              <button
                type="button"
                className={draft.id === profile.id ? "active" : ""}
                onClick={() => {
                  if (profile.id !== draft.id)
                    requestTransition(() => selectProfile(profile));
                }}
              >
                <strong>{profile.name}</strong>
                <small>
                  {profile.id === activeProfileId
                    ? t("Active", "Activo")
                    : t("Saved profile", "Perfil guardado")}
                </small>
              </button>
            </div>
          ))}
        </div>

        <div className="publication-manager-fields">
          <label>
            <span>{t("Profile name", "Nombre del perfil")}</span>
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <CompendiumGroup
            id="publication-rules"
            title={t(
              "Automatic inclusion rules",
              "Reglas de inclusión automática",
            )}
          >
            <div className="publication-manager-statuses">
              <span>
                {t(
                  "Statuses included automatically",
                  "Estados incluidos automáticamente",
                )}
              </span>
              <span className="publication-status-list publication-status-list-inline">
                {statuses.map((status) => (
                  <label
                    key={status}
                    className="publication-status-option compact"
                  >
                    <input
                      type="checkbox"
                      checked={draft.rules.statuses.includes(status)}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          rules: {
                            statuses: event.target.checked
                              ? [
                                  ...new Set([
                                    ...current.rules.statuses,
                                    status,
                                  ]),
                                ]
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
          </CompendiumGroup>
          <CompendiumGroup
            id="publication-advanced"
            title={t(
              "Advanced settings and profile actions",
              "Ajustes avanzados y acciones del perfil",
            )}
          >
            <dl>
              <dt>{t("Profile ID", "ID del perfil")}</dt>
              <dd>{draft.id}</dd>
              <dt>{t("Dependency policy", "Política de dependencias")}</dt>
              <dd>{draft.dependencyPolicy}</dd>
            </dl>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving || profiles.length <= 1}
            >
              {t("Delete profile", "Eliminar perfil")}
            </button>
          </CompendiumGroup>
        </div>

        <Summary preview={preview} />

        <div className="publication-picker-toolbar">
          <label className="publication-search">
            <span className="visually-hidden">
              {t("Filter content", "Filtrar contenido")}
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                "Filter by name, id, tag or folder…",
                "Filtrar por nombre, ID, etiqueta o carpeta…",
              )}
            />
          </label>
          <label>
            <span className="visually-hidden">
              {t("Entity type", "Tipo de ficha")}
            </span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="all">{t("All types", "Todos los tipos")}</option>
              {types.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">
              {t("Entity folder", "Carpeta de la ficha")}
            </span>
            <select
              value={folderFilter}
              onChange={(event) => setFolderFilter(event.target.value)}
            >
              <option value="all">
                {t("All folders", "Todas las carpetas")}
              </option>
              {folders.map((folder) => (
                <option value={folder} key={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">
              {t("Entity tag", "Etiqueta de la ficha")}
            </span>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="all">
                {t("All tags", "Todas las etiquetas")}
              </option>
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
              <h4>{t("Entities", "Fichas")}</h4>
              <span>
                {filteredEntities.length} {t("indexed", "indexados")}
              </span>
            </header>
            <div className="publication-picker-list">
              {!filteredEntities.length && (
                <p className="cp-empty">
                  {t(
                    "No entries match these filters.",
                    "Ninguna ficha coincide con estos filtros.",
                  )}
                </p>
              )}
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
                        {badge === "not-included"
                          ? t("not included", "no incluido")
                          : selectionLabel(badge)}
                      </span>
                      {hasWarning ? (
                        <span className="publication-badge publication-badge-warning">
                          {t("warning", "aviso")}{" "}
                        </span>
                      ) : null}
                    </div>
                    <SelectionControl
                      value={selectionState(draft, "entityIds", entity.id)}
                      onChange={(value) =>
                        setDraft((current) =>
                          updateSelection(
                            current,
                            "entityIds",
                            entity.id,
                            value,
                          ),
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
              <h4>{t("Stories", "Historias")}</h4>
              <span>
                {indexed.stories.length} {t("indexed", "indexados")}
              </span>
            </header>
            <div className="publication-picker-list publication-story-tree">
              {!indexed.stories.length && (
                <p className="cp-empty">
                  {t(
                    "No stories in this universe.",
                    "No hay historias en este universo.",
                  )}
                </p>
              )}
              {indexed.stories.map((story) => (
                <div key={story.id} className="publication-story-node">
                  <div className="publication-picker-row">
                    <div>
                      <strong>{story.name}</strong>
                      <small>{t("Story", "Historia")}</small>
                      <details className="cp-technical-id">
                        <summary>{t("Details", "Detalles")}</summary>
                        <code>{story.id}</code>
                      </details>
                      <span className="publication-badge publication-badge-story">
                        {draft.selection.storyIds.exclude.includes(story.id)
                          ? t("excluded", "excluido")
                          : draft.selection.storyIds.include.includes(story.id)
                            ? t("selected", "seleccionado")
                            : t("automatic", "automático")}
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
                          <small>{t("Sequence", "Secuencia")}</small>
                          <details className="cp-technical-id">
                            <summary>{t("Details", "Detalles")}</summary>
                            <code>{sequence.id}</code>
                          </details>
                          <span className="publication-badge publication-badge-story">
                            {selectionLabel(
                              selectionState(draft, "sequenceIds", sequence.id),
                            )}
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
                              <small>{t("Event", "Evento")}</small>
                              <details className="cp-technical-id">
                                <summary>{t("Details", "Detalles")}</summary>
                                <code>{event.id}</code>
                              </details>
                              <span className="publication-badge publication-badge-story">
                                {selectionLabel(
                                  selectionState(draft, "eventIds", event.id),
                                )}
                              </span>
                            </div>
                            <SelectionControl
                              value={selectionState(
                                draft,
                                "eventIds",
                                event.id,
                              )}
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
            <strong>
              {t("Review before export", "Revisar antes de exportar")}
            </strong>
            <ul>
              {preview.warnings.slice(0, 5).map((warning, index) => (
                <li key={`${warning}-${index}`}>{diagnosticText(warning)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {operationError ? (
          <div className="publication-warning-list" role="alert">
            {diagnosticText(operationError)}
          </div>
        ) : null}
        <div className="publication-footer-actions">
          <button data-onboarding-target="compendium.preview" type="button" onClick={() => { onPreview(draft); onLearningAction?.("publication-previewed"); }}>
            {t("Open Preview", "Abrir vista previa")}{" "}
          </button>
          <button data-onboarding-target="compendium.export" type="button" onClick={() => void copyExportCommand()}>
            {t("Copy ZIP command", "Copiar comando ZIP")}
          </button>
          <small>
            {t(
              "Export always uses Preview. The button copies the reproducible ZIP command.",
              "La exportación usa la vista previa. Este botón copia el comando para generar el ZIP.",
            )}{" "}
          </small>
        </div>
      </fieldset>
      {pendingTransition && (
        <div className="cp-unsaved-dialog">
          <section
            ref={dialogRef as React.RefObject<HTMLElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby={promptTitle}
            tabIndex={-1}
          >
            <h2 id={promptTitle}>
              {t("Unsaved profile", "Perfil sin guardar")}
            </h2>
            <p>
              {t(
                "Save this draft before switching profiles?",
                "¿Guardar este borrador antes de cambiar de perfil?",
              )}
            </p>
            {operationError && (
              <p role="alert">{diagnosticText(operationError)}</p>
            )}
            <footer>
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingTransition(undefined)}
              >
                {t("Cancel", "Cancelar")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  const next = pendingTransition;
                  setPendingTransition(undefined);
                  next();
                }}
              >
                {t("Discard changes", "Descartar cambios")}
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={saving}
                onClick={async () => {
                  if (await save()) {
                    const next = pendingTransition;
                    setPendingTransition(undefined);
                    next();
                  }
                }}
              >
                {saving ? t("Saving…", "Guardando…") : t("Save", "Guardar")}
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
