import { useCompendiumText } from "./compendiumPresentation";
import type { Entity, SiteData, Story, StoryEvent } from "../types";
import { EntryBody } from "./EntryBody";
import { VaultAssetImage } from "./VaultAssetImage";
import type { ReaderNavigation } from "./Reader";

export function EventPage({
  site,
  story,
  event,
  navigate,
}: {
  site: SiteData;
  story: Story;
  event: StoryEvent;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  const refs = event.canonRefs
    .map((id) => site.entities.find((entity) => entity.id === id))
    .filter((value): value is Entity => Boolean(value));

  return (
    <div className="entry-layout">
      <article className="entry">
        {event.coverImage ? (
          <VaultAssetImage
            path={event.coverImage}
            vaultPath={site.vaultPath}
            alt=""
            className="event-cover-image"
          />
        ) : null}
        {event.images && event.images.length > 1 ? (
          <div
            className="event-image-gallery"
            aria-label={t("Scene images", "Imágenes de la escena")}
          >
            {event.images.slice(1).map((path) => (
              <VaultAssetImage
                key={path}
                path={path}
                vaultPath={site.vaultPath}
                alt=""
                className="event-scene-image"
              />
            ))}
          </div>
        ) : null}
        <div className="entry-heading">
          <p className="chapter">{story.name}</p>
          <h1>{event.name}</h1>
          {event.description ? <p>{event.description}</p> : null}
        </div>
        {event.html ? (
          <EntryBody
            html={event.html}
            vaultPath={site.vaultPath}
            navigate={navigate}
          />
        ) : null}
        {event.choices?.length ? (
          <nav
            className="narrative-choice-list"
            aria-label={t("Narrative choices", "Opciones narrativas")}
          >
            <h2>{t("Choose a route", "Elige una ruta")}</h2>
            <div>
              {event.choices.map((choice) => (
                <button
                  type="button"
                  key={choice.id}
                  onClick={() => navigate(choice.targetRoute)}
                >
                  <strong>{choice.label}</strong>
                  <span>
                    {t("Continue to", "Continuar hacia")} {choice.destinationName}
                  </span>
                </button>
              ))}
            </div>
          </nav>
        ) : null}
      </article>
      <aside className="related">
        <section>
          <h2>{t("Canon references", "Referencias al canon")}</h2>
          {refs.length ? (
            <ul>
              {refs.map((entity) => (
                <li key={entity.id}>
                  <button type="button" onClick={() => navigate(entity.route)}>
                    {entity.name}
                  </button>
                  <span>{entity.type}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {t(
                "No canon references in this scene.",
                "Esta escena no tiene referencias al canon.",
              )}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
