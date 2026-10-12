import { useCompendiumText } from "./compendiumPresentation";
import { PencilLine } from "lucide-react";
import type { Entity, SiteData } from "../types";
import { EntryBody } from "./EntryBody";
import { VaultAssetImage } from "./VaultAssetImage";
import type { ReaderNavigation } from "./Reader";

export function EntryPage({
  site,
  entity,
  navigate,
  onSuggestCorrection,
}: {
  site: SiteData;
  entity: Entity;
  navigate: ReaderNavigation;
  onSuggestCorrection?: (entity: Entity) => void;
}) {
  const t = useCompendiumText();
  const related = entity.backlinks
    .map((id) => site.entities.find((candidate) => candidate.id === id))
    .filter((value): value is Entity => Boolean(value));
  const appearances = site.stories.flatMap((story) =>
    story.sequences.flatMap((sequence) =>
      sequence.events
        .filter((event) => event.canonRefs.includes(entity.id))
        .map((event) => ({ event, story })),
    ),
  );

  return (
    <div className="entry-layout">
      <article className="entry">
        {entity.presentation?.cover ? (
          <VaultAssetImage
            path={entity.presentation.cover}
            vaultPath={site.vaultPath}
            alt=""
            className="entry-cover-image"
          />
        ) : null}
        <div className="entry-heading">
          <div className="entry-heading-meta">
            <p className="chapter">{entity.type}</p>
            {onSuggestCorrection ? (
              <button
                type="button"
                className="suggest-correction-button"
                onClick={() => onSuggestCorrection(entity)}
              >
                <PencilLine size={14} />{" "}
                {t("Suggest correction", "Sugerir corrección")}{" "}
              </button>
            ) : null}
          </div>
          <div className="entry-title-row">
            {entity.presentation?.portrait ? (
              <VaultAssetImage
                path={entity.presentation.portrait}
                vaultPath={site.vaultPath}
                alt={t(`${entity.name} portrait`, `Retrato de ${entity.name}`)}
                className="entry-portrait-image"
              />
            ) : null}
            <h1>{entity.name}</h1>
          </div>
          {entity.tags.length > 0 ? (
            <p className="tags">{entity.tags.join(" · ")}</p>
          ) : null}
        </div>
        <EntryBody
          html={entity.html}
          vaultPath={site.vaultPath}
          navigate={navigate}
        />
      </article>
      <aside className="related">
        <section>
          <h2>{t("Related entries", "Fichas relacionadas")}</h2>
          {related.length ? (
            <ul>
              {related.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => navigate(item.route)}>
                    {item.name}
                  </button>
                  <span>{item.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {t(
                "No published backlinks yet.",
                "Todavía no hay enlaces entrantes publicados.",
              )}
            </p>
          )}
        </section>
        <section>
          <h2>{t("Appears in stories", "Apariciones en historias")}</h2>
          {appearances.length ? (
            <ul>
              {appearances.map(({ event, story }) => (
                <li key={event.route}>
                  <button type="button" onClick={() => navigate(event.route)}>
                    {event.name}
                  </button>
                  <span>{story.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {t(
                "No published scenes reference this entry.",
                "Ninguna escena publicada menciona esta ficha.",
              )}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
