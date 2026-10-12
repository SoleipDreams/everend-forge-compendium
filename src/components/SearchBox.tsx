import { useId, useMemo, useRef, useState } from "react";
import { useCompendiumText } from "./compendiumPresentation";
import type { SiteData } from "../types";
import type { ReaderNavigation } from "./Reader";

type SearchEntry = { name: string; type: string; route: string };

export function SearchBox({
  site,
  navigate,
}: {
  site: SiteData;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  const id = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const entries = useMemo<SearchEntry[]>(
    () => [
      ...site.entities.map((entity) => ({
        name: entity.name,
        type: entity.type,
        route: entity.route,
      })),
      ...site.stories.flatMap((story) =>
        story.sequences.flatMap((sequence) =>
          sequence.events.map((event) => ({
            name: event.name,
            type: story.name,
            route: event.route,
          })),
        ),
      ),
    ],
    [site],
  );

  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return entries
      .filter((entry) =>
        `${entry.name} ${entry.type}`.toLowerCase().includes(trimmed),
      )
      .slice(0, 8);
  }, [entries, query]);

  return (
    <div className="search">
      <input
        ref={inputRef}
        type="search"
        placeholder={t("Search the Compendium...", "Buscar en Compendium…")}
        autoComplete="off"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(-1);
          setExpanded(true);
        }}
        onFocus={() => setExpanded(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget))
            setExpanded(false);
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded && Boolean(query.trim())}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          expanded && matches.length && activeIndex >= 0
            ? `${id}-${Math.max(0, Math.min(activeIndex, matches.length - 1))}`
            : undefined
        }
        onKeyDown={(event) => {
          if (
            (event.key === "ArrowDown" || event.key === "ArrowUp") &&
            matches.length
          ) {
            event.preventDefault();
            setExpanded(true);
            setActiveIndex((index) =>
              index < 0
                ? event.key === "ArrowDown"
                  ? 0
                  : matches.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    matches.length) %
                  matches.length,
            );
          }
          if (event.key === "Enter" && matches.length > 0) {
            event.preventDefault();
            navigate(
              matches[Math.max(0, Math.min(activeIndex, matches.length - 1))]
                .route,
            );
            setQuery("");
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
            setExpanded(false);
          }
        }}
        aria-label={t("Search the Compendium", "Buscar en Compendium")}
      />
      {expanded && query.trim() ? (
        <ul
          id={`${id}-results`}
          className="search-results"
          role="listbox"
          aria-label={t("Search results", "Resultados de búsqueda")}
        >
          {!matches.length && (
            <li className="cp-empty" role="presentation">
              {t("No matching entries.", "No hay resultados.")}
            </li>
          )}
          {matches.map((entry, index) => (
            <li key={entry.route} role="presentation">
              <button
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
                onClick={() => {
                  navigate(entry.route);
                  setQuery("");
                }}
              >
                {entry.name} <span>· {entry.type}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
