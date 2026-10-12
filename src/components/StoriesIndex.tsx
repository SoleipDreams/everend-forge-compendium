import { useCompendiumText } from "./compendiumPresentation";
import type { SiteData } from "../types";
import type { ReaderNavigation } from "./Reader";

export function StoriesIndex({
  site,
  navigate,
}: {
  site: SiteData;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  return (
    <>
      <section className="page-title">
        <p className="chapter">{t("Narrative archive", "Archivo narrativo")}</p>
        <h1>{t("Stories", "Historias")}</h1>
        <p>
          {t(
            "Editorial scenes and their canon relationships, without interactive-game logic.",
            "Escenas narrativas y sus relaciones con el canon.",
          )}{" "}
        </p>
      </section>
      <section className="story-list">
        {site.stories.map((story) => (
          <article key={story.id}>
            <h2>
              <button type="button" onClick={() => navigate(story.route)}>
                {story.name}
              </button>
            </h2>
            <p>
              {story.sequences.reduce(
                (total, sequence) => total + sequence.events.length,
                0,
              )}{" "}
              {t("published scenes", "escenas publicadas")}{" "}
            </p>
          </article>
        ))}
        {site.stories.length === 0 ? (
          <p>
            {t(
              "No published stories yet.",
              "Todavía no hay historias publicadas.",
            )}
          </p>
        ) : null}
      </section>
    </>
  );
}
