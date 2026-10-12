import { useCompendiumText } from "./compendiumPresentation";
import type { Entity, SiteData } from "../types";
import { BookComingSoon } from "./BookComingSoon";
import { CoverPage } from "./CoverPage";
import { EntryPage } from "./EntryPage";
import { EventPage } from "./EventPage";
import { GraphView } from "./GraphView";
import { MapsView } from "./MapsView";
import { StoriesIndex } from "./StoriesIndex";
import { StoryPage } from "./StoryPage";
import { TimelineView } from "./TimelineView";
import { useSurfaceMotion } from "../useSurfaceMotion";

export type ReaderMode = "web" | "book";

export type ReaderNavigation = (route: string) => void;

function findEntity(site: SiteData, route: string): Entity | undefined {
  return site.entities.find((entity) => entity.route === route);
}

export function Reader({
  site,
  mode,
  route,
  navigate,
  refresh,
  onSuggestCorrection,
}: {
  site: SiteData;
  mode: ReaderMode;
  route: string;
  navigate: ReaderNavigation;
  refresh: () => void;
  onSuggestCorrection?: (entity: Entity) => void;
}) {
  const t = useCompendiumText();
  const contentRef = useSurfaceMotion<HTMLDivElement>(`${mode}:${route}`);
  if (mode === "book") {
    return <BookComingSoon />;
  }

  let content: React.ReactNode;
  if (route === "/") {
    content = <CoverPage site={site} navigate={navigate} />;
  } else if (route === "/stories/") {
    content = <StoriesIndex site={site} navigate={navigate} />;
  } else if (route === "/graph/") {
    content = <GraphView site={site} navigate={navigate} />;
  } else if (route === "/timeline/") {
    content = <TimelineView site={site} navigate={navigate} />;
  } else if (route === "/maps/") {
    content = <MapsView site={site} navigate={navigate} />;
  } else {
    const entity = findEntity(site, route);
    if (entity) {
      content = (
        <EntryPage
          site={site}
          entity={entity}
          navigate={navigate}
          onSuggestCorrection={onSuggestCorrection}
        />
      );
    } else {
      const story = site.stories.find((candidate) => candidate.route === route);
      if (story) {
        content = <StoryPage site={site} story={story} navigate={navigate} />;
      } else {
        const match = site.stories
          .flatMap((candidate) =>
            candidate.sequences.flatMap((sequence) =>
              sequence.events.map((event) => ({ story: candidate, event })),
            ),
          )
          .find(({ event }) => event.route === route);
        if (match) {
          content = (
            <EventPage
              site={site}
              story={match.story}
              event={match.event}
              navigate={navigate}
            />
          );
        } else {
          content = (
            <section className="page-title">
              <p className="chapter">
                {t("Not found", "Página no encontrada")}
              </p>
              <h1>
                {t(
                  "This page is not part of the published Compendium.",
                  "Esta página no forma parte del Compendium publicado.",
                )}
              </h1>
              <button
                type="button"
                className="primary-action"
                onClick={refresh}
              >
                {t("Reload universe", "Recargar universo")}{" "}
              </button>
            </section>
          );
        }
      }
    }
  }

  const fullBleed = route === "/graph/" || route === "/maps/";
  return (
    <div className={`reader-shell ${fullBleed ? "full-bleed" : ""}`}>
      <div ref={contentRef} className="reader-main">
        {content}
      </div>
    </div>
  );
}
