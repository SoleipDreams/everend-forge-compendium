import { useCompendiumText } from "./compendiumPresentation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FilePenLine, X } from "lucide-react";
import { saveUniverseTextFile } from "../tauriBridge";
import { useDialogFocus } from "../useDialogFocus";
import type { Entity, SiteData } from "../types";
import {
  useUniverseSwitchGuard,
  type RegisterUniverseSwitchGuard,
} from "../useUniverseSwitchGuard";

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function contentHash(content: string) {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function simpleDiff(before: string, after: string) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  let start = 0;
  while (oldLines[start] === newLines[start] && start < oldLines.length)
    start += 1;
  let oldEnd = oldLines.length - 1;
  let newEnd = newLines.length - 1;
  while (
    oldEnd >= start &&
    newEnd >= start &&
    oldLines[oldEnd] === newLines[newEnd]
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return [
    ...oldLines.slice(start, oldEnd + 1).map((line) => `-${line}`),
    ...newLines.slice(start, newEnd + 1).map((line) => `+${line}`),
  ].join("\n");
}

export function CorrectionDialog({
  active,
  site,
  entity,
  onClose,
  registerUniverseSwitchGuard,
}: {
  active?: boolean;
  site: SiteData;
  entity: Entity;
  onClose: () => void;
  registerUniverseSwitchGuard?: RegisterUniverseSwitchGuard;
}) {
  const t = useCompendiumText();
  const [proposedContent, setProposedContent] = useState(entity.sourceContent);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<
    "editing" | "saving" | "saved" | "error"
  >("editing");
  const [message, setMessage] = useState("");
  const dialogRef = useDialogFocus({
    active,
    onClose,
    canClose: status !== "saving",
  });
  const changed = proposedContent !== entity.sourceContent;
  useUniverseSwitchGuard(
    registerUniverseSwitchGuard,
    status === "saving" ||
      (status !== "saved" && (changed || Boolean(note.trim()))),
  );
  const changedLineCount = useMemo(
    () =>
      simpleDiff(entity.sourceContent, proposedContent)
        .split("\n")
        .filter(Boolean).length,
    [entity.sourceContent, proposedContent],
  );

  async function saveProposal() {
    if (!changed) return;
    setStatus("saving");
    try {
      const timestamp = new Date();
      const suffix = timestamp.toISOString().replace(/[:.]/g, "-");
      const id = `change:${slug(entity.id)}:compendium-${suffix}`;
      const proposal = {
        specVersion: "0.1",
        id,
        kind: "canon-change-set",
        sourceApp: "compendium",
        target: { entityId: entity.id, path: entity.path },
        base: {
          content: entity.sourceContent,
          modifiedMs: entity.modifiedMs ?? 0,
          contentHash: await contentHash(entity.sourceContent),
          capturedAt: timestamp.toISOString(),
        },
        proposed: {
          content: proposedContent,
          diff: simpleDiff(entity.sourceContent, proposedContent),
        },
        status: "proposed",
        revision: 1,
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString(),
        note: note.trim() || undefined,
      };
      const relativePath = `.everend/changes/${slug(entity.id)}-compendium-${suffix}.json`;
      const result = await saveUniverseTextFile(
        site.vaultPath,
        relativePath,
        `${JSON.stringify(proposal, null, 2)}\n`,
      );
      if (!result.ok)
        throw new Error(
          result.message ??
            t("Could not save proposal.", "No se pudo guardar la propuesta."),
        );
      setMessage(
        t(
          `Saved for review in ${relativePath}`,
          `Guardado para revisión en ${relativePath}`,
        ),
      );
      setStatus("saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  }

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && status !== "saving")
          onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="correction-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="correction-title"
      >
        <header className="dialog-header">
          <div>
            <span className="dialog-kicker">
              {t("Reviewable change", "Cambio para revisión")}
            </span>
            <h2 id="correction-title">
              {t("Suggest a correction", "Sugerir una corrección")}
            </h2>
            <p>
              {entity.name} · {entity.path}
            </p>
          </div>
          <button
            type="button"
            className="dialog-close"
            onClick={onClose}
            disabled={status === "saving"}
            title={t("Close", "Cerrar")}
          >
            <X size={18} />
          </button>
        </header>
        <div className="correction-safety-note">
          <AlertTriangle size={16} />
          <span>
            {t(
              "This creates a proposal for WorldNotion. The Canon file is never changed here.",
              "Se creará una propuesta para WorldNotion. El archivo del canon se conserva.",
            )}{" "}
          </span>
        </div>
        {status === "saved" ? (
          <div className="correction-success">
            <CheckCircle2 size={34} />
            <h3>
              {t(
                "Correction ready for review",
                "Corrección lista para revisión",
              )}
            </h3>
            <p>{message}</p>
            <button type="button" className="primary-action" onClick={onClose}>
              {t("Done", "Listo")}{" "}
            </button>
          </div>
        ) : (
          <>
            <div className="correction-editor-grid">
              <label>
                <span>{t("Proposed Markdown", "Markdown propuesto")}</span>
                <textarea
                  disabled={status === "saving"}
                  value={proposedContent}
                  onChange={(event) => setProposedContent(event.target.value)}
                  spellCheck
                />
              </label>
              <aside>
                <FilePenLine size={20} />
                <strong>
                  {changed
                    ? t(
                        `${changedLineCount} changed lines`,
                        `${changedLineCount} líneas modificadas`,
                      )
                    : t("No changes yet", "Todavía no hay cambios")}
                </strong>
                <p>
                  {t(
                    "Edit the source exactly as it should appear. Frontmatter is included so metadata corrections are possible.",
                    "Edita el contenido como debe aparecer. Puedes corregir también los metadatos del frontmatter.",
                  )}{" "}
                </p>
                <label>
                  <span>
                    {t("Reason for the correction", "Motivo de la corrección")}
                  </span>
                  <textarea
                    disabled={status === "saving"}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t(
                      "Explain what is wrong and why this change helps…",
                      "Explica el error y el motivo de este cambio…",
                    )}
                  />
                </label>
              </aside>
            </div>
            {status === "error" ? (
              <p className="dialog-error">{message}</p>
            ) : null}
            <footer className="dialog-footer">
              <button
                type="button"
                onClick={onClose}
                disabled={status === "saving"}
              >
                {t("Cancel", "Cancelar")}{" "}
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={!changed || status === "saving"}
                onClick={() => void saveProposal()}
              >
                {status === "saving"
                  ? t("Saving proposal…", "Guardando propuesta…")
                  : t(
                      "Send to WorldNotion review",
                      "Enviar a revisión en WorldNotion",
                    )}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
