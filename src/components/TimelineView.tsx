import { useCompendiumText } from "./compendiumPresentation";
import { useMemo } from "react";
import type { Entity, SiteData } from "../types";
import type { ReaderNavigation } from "./Reader";

type TimelineEntry = {
  entity: Entity;
  label: string;
  sortValue: number;
};

/** Extracts the first number in a date-like string ("Year 1024", "1024-05-12"). */
function sortValueFor(value: string): number | undefined {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

export function timelineEntries(site: SiteData): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const entity of site.entities) {
    const dateValue = entity.date ?? entity.start;
    if (!dateValue) continue;
    const sortValue = sortValueFor(dateValue);
    if (sortValue === undefined) continue;
    const label = entity.end ? `${dateValue} – ${entity.end}` : dateValue;
    entries.push({ entity, label, sortValue });
  }
  return entries.sort(
    (left, right) =>
      left.sortValue - right.sortValue ||
      left.entity.name.localeCompare(right.entity.name),
  );
}

export function TimelineView({
  site,
  navigate,
}: {
  site: SiteData;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  const entries = useMemo(() => timelineEntries(site), [site]);

  if (entries.length === 0) {
    return (
      <section className="page-title">
        <p className="chapter">{t("Timeline", "Cronología")}</p>
        <h1>
          {t("No dated entries yet.", "Todavía no hay fichas con fecha.")}
        </h1>
        <p>
          {t("Add a", "Añade un campo")} <code>date:</code> {t("(or", "(o")}{" "}
          <code>start:</code> / <code>end:</code>
          {t(
            ") field to an entity's frontmatter to place it on the timeline.",
            ") al frontmatter de una ficha para incluirla en la cronología.",
          )}{" "}
        </p>
      </section>
    );
  }

  let lastEra: number | undefined;
  return (
    <>
      <section className="page-title">
        <p className="chapter">{t("Chronology", "Cronología")}</p>
        <h1>{t("Timeline", "Cronología")}</h1>
        <p>
          {t(
            "Every dated entry of the universe, in canonical order.",
            "Todas las fichas fechadas del universo, en orden canónico.",
          )}
        </p>
      </section>
      <ol className="timeline">
        {entries.map(({ entity, label, sortValue }) => {
          const era = Math.trunc(sortValue);
          const showEra = era !== lastEra;
          lastEra = era;
          return (
            <li key={entity.id}>
              {showEra ? <p className="timeline-era">{era}</p> : null}
              <div className="timeline-item">
                <span className="timeline-date">{label}</span>
                <button type="button" onClick={() => navigate(entity.route)}>
                  {entity.name}
                </button>
                <span className="timeline-type">{entity.type}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
