import { useCompendiumText } from "./compendiumPresentation";
import type { SiteData, Story } from "../types";
import type { ReaderNavigation } from "./Reader";

export function StoryPage({
  story,
  navigate,
}: {
  site: SiteData;
  story: Story;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  return (
    <>
      <section className="page-title">
        <p className="chapter">{t("Story", "Historia")}</p>
        <h1>{story.name}</h1>
      </section>
      {story.sequences.map((sequence) => (
        <section className="sequence" key={sequence.id}>
          <h2>{sequence.name}</h2>
          <ol>
            {sequence.events.map((event) => (
              <li key={event.id}>
                <button type="button" onClick={() => navigate(event.route)}>
                  {event.name}
                </button>
                {event.description ? <p>{event.description}</p> : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
