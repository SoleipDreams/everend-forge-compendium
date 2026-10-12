import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BookOpen,
  Home,
  Library,
  Network,
  PanelLeftClose,
  Upload,
} from "lucide-react";
import type { SiteData } from "../types";
import { loadSettings, type CompendiumExplorerSettings } from "../settings";
import {
  orderedTypes,
  IndexContext,
  useCompendiumText,
} from "./compendiumPresentation";
import { mapDefinitions } from "./MapsView";
import { timelineEntries } from "./TimelineView";

export function CompendiumWorkspace({
  site,
  route,
  publication,
  onPublication,
  onPreferencesChange,
  navigate,
  children,
}: {
  site: SiteData;
  route: string;
  publication: boolean;
  onPublication: (open: boolean) => void;
  onPreferencesChange: (prefs: CompendiumExplorerSettings) => void;
  navigate: (route: string) => void;
  children: ReactNode;
}) {
  const t = useCompendiumText();
  const [prefs, setPrefs] = useState<CompendiumExplorerSettings>(
    () => loadSettings().explorer!,
  );
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(1200);
  const [wideOpen, setWideOpen] = useState(false);
  const [pendingType, setPendingType] = useState<string>();
  const wide = !publication && (route === "/graph/" || route === "/maps/");
  const opened = wide ? wideOpen : prefs.open;
  const overlay = available - 16 - 40 - prefs.width - 8 < 560;
  const section = publication
    ? "publication"
    : prefs.section === "publication"
      ? "index"
      : prefs.section;
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setAvailable(width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setWideOpen(false);
  }, [wide, route]);
  useEffect(() => {
    setPrefs((current) => {
      if (publication && current.section !== "publication")
        return { ...current, section: "publication" };
      if (!publication && current.section === "publication")
        return { ...current, section: "index" };
      return current;
    });
  }, [publication]);
  useEffect(() => {
    onPreferencesChange(prefs);
  }, [prefs]);
  const close = () => {
    if (panel.current?.contains(document.activeElement))
      rail.current
        ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
        ?.focus();
    if (wide) setWideOpen(false);
    else setPrefs((p) => ({ ...p, open: false }));
  };
  const openSection = (next: CompendiumExplorerSettings["section"]) => {
    onPublication(next === "publication");
    setPrefs((p) => ({ ...p, section: next, open: true }));
    if (wide) setWideOpen(true);
    if (next === "cover") navigate("/");
    if (next === "stories") navigate("/stories/");
  };
  const openIndex = (type: string) => {
    onPublication(false);
    setPendingType(type);
    setWideOpen(true);
    setPrefs((p) => ({
      ...p,
      section: "index",
      open: true,
      collapsed: p.collapsed.filter((id) => id !== `type:${type}`),
    }));
  };
  useEffect(() => {
    if (!pendingType) return;
    const group = [
      ...(panel.current?.querySelectorAll<HTMLElement>("[data-index-type]") ??
        []),
    ].find((el) => el.dataset.indexType === pendingType);
    group?.scrollIntoView({ block: "nearest" });
    group?.querySelector<HTMLButtonElement>("button")?.focus();
    setPendingType(undefined);
  }, [pendingType, prefs]);
  useEffect(() => {
    const selected = panel.current?.querySelector<HTMLElement>(
      'button[aria-current="page"]',
    );
    if (opened) selected?.scrollIntoView({ block: "nearest" });
  }, [route, section, opened]);
  useEffect(() => {
    const entity = site.entities.find((item) => item.route === route);
    const story = site.stories.find(
      (item) =>
        item.route === route ||
        item.sequences.some((seq) =>
          seq.events.some((event) => event.route === route),
        ),
    );
    const sequence = story?.sequences.find((seq) =>
      seq.events.some((event) => event.route === route),
    );
    const reveal = [
      entity && `type:${entity.type}`,
      story && `story:${story.id}`,
      sequence && `sequence:${sequence.id}`,
    ].filter(Boolean);
    setPrefs((current) =>
      current.collapsed.some((id) => reveal.includes(id))
        ? {
            ...current,
            collapsed: current.collapsed.filter((id) => !reveal.includes(id)),
          }
        : current,
    );
  }, [route, site]);
  const choose = (next: string) => {
    onPublication(false);
    navigate(next);
    if (overlay) close();
  };
  const toggleGroup = (id: string) =>
    setPrefs((p) => ({
      ...p,
      collapsed: p.collapsed.includes(id)
        ? p.collapsed.filter((x) => x !== id)
        : [...p.collapsed, id],
    }));
  const group = (
    id: string,
    title: string,
    count: number,
    body: ReactNode,
    type?: string,
  ) => (
    <section key={id} data-index-type={type} className="cp-index-group">
      <button
        type="button"
        className="cp-index-heading"
        aria-expanded={!prefs.collapsed.includes(id)}
        onClick={() => toggleGroup(id)}
      >
        <span aria-hidden="true">
          {prefs.collapsed.includes(id) ? "›" : "⌄"}
        </span>
        <strong>{title}</strong>
        <small>{count}</small>
      </button>
      <div hidden={prefs.collapsed.includes(id)}>{body}</div>
    </section>
  );
  const link = (name: string, target: string) => (
    <button
      key={target}
      type="button"
      className="cp-index-link"
      aria-current={route === target ? "page" : undefined}
      onClick={() => choose(target)}
    >
      {name}
    </button>
  );
  const views = [
    { id: "cover" as const, label: t("Cover", "Portada"), Icon: Home },
    { id: "index" as const, label: t("Index", "Índice"), Icon: Library },
    {
      id: "stories" as const,
      label: t("Stories", "Historias"),
      Icon: BookOpen,
    },
    { id: "views" as const, label: t("Views", "Vistas"), Icon: Network },
    {
      id: "publication" as const,
      label: t("Publication", "Publicación"),
      Icon: Upload,
    },
  ];
  const resize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const start = event.clientX;
    const width = prefs.width;
    const move = (e: PointerEvent) =>
      setPrefs((p) => ({
        ...p,
        width: Math.max(220, Math.min(420, width + e.clientX - start)),
      }));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };
  return (
    <IndexContext.Provider value={openIndex}>
      <div
        ref={root}
        className={`cp-workspace ${overlay ? "overlay" : ""}`}
        style={
          {
            gridTemplateColumns: `${40 + (opened && !overlay ? prefs.width : 0)}px minmax(0,1fr)`,
            "--cp-explorer-width": `${prefs.width}px`,
          } as React.CSSProperties
        }
      >
        <aside
          className={`cp-explorer ${opened ? "open" : ""}`}
          aria-label={t("Reading explorer", "Explorador de lectura")}
        >
          <nav
            ref={rail}
            className="cp-explorer-rail"
            aria-label={t("Compendium sections", "Secciones de Compendium")}
          >
            {views.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={section === id}
                onClick={() => openSection(id)}
              >
                <Icon size={18} />
              </button>
            ))}
          </nav>
          <div
            ref={panel}
            className="cp-explorer-panel"
            hidden={!opened}
            onKeyDown={(event) => {
              if (
                event.key === "Escape" &&
                !(event.target as Element).closest(
                  '[role="dialog"],[role="menu"]',
                )
              ) {
                event.preventDefault();
                event.stopPropagation();
                close();
              }
            }}
          >
            <header>
              <strong>
                {views.find((view) => view.id === section)?.label}
              </strong>
              <button
                type="button"
                onClick={close}
                aria-label={t("Collapse explorer", "Plegar explorador")}
              >
                <PanelLeftClose size={16} />
              </button>
            </header>
            <div className="cp-explorer-scroll">
              <div hidden={section !== "cover"}>
                <p>{site.description}</p>
                {link(site.title, "/")}
              </div>
              <div hidden={section !== "index"}>
                {orderedTypes(site).map((type) => {
                  const entries = site.entities.filter(
                    (entity) => entity.type === type,
                  );
                  return group(
                    `type:${type}`,
                    type,
                    entries.length,
                    entries.map((entity) => link(entity.name, entity.route)),
                    type,
                  );
                })}
                {!site.entities.length && (
                  <p className="cp-empty">
                    {t(
                      "No entries in this edition.",
                      "No hay fichas en esta edición.",
                    )}
                  </p>
                )}
              </div>
              <div hidden={section !== "stories"}>
                {link(t("All stories", "Todas las historias"), "/stories/")}
                {site.stories.map((story) =>
                  group(
                    `story:${story.id}`,
                    story.name,
                    story.sequences.length,
                    <>
                      {link(story.name, story.route)}
                      {story.sequences.map((sequence) =>
                        group(
                          `sequence:${sequence.id}`,
                          sequence.name,
                          sequence.events.length,
                          sequence.events.map((event) =>
                            link(event.name, event.route),
                          ),
                        ),
                      )}
                    </>,
                  ),
                )}
                {!site.stories.length && (
                  <p className="cp-empty">
                    {t(
                      "No stories in this edition.",
                      "No hay historias en esta edición.",
                    )}
                  </p>
                )}
              </div>
              <div hidden={section !== "views"}>
                {link(t("Graph", "Grafo"), "/graph/")}
                {timelineEntries(site).length > 0 &&
                  link(t("Timeline", "Cronología"), "/timeline/")}
                {mapDefinitions(site).length > 0 &&
                  link(t("Maps", "Mapas"), "/maps/")}
              </div>
              <div hidden={section !== "publication"}>
                <p>
                  {t(
                    "Profiles, selection and publication diagnostics.",
                    "Perfiles, selección y diagnóstico de publicación.",
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="cp-explorer-resize"
              aria-label={t("Resize explorer", "Redimensionar explorador")}
              onPointerDown={resize}
              onDoubleClick={() => setPrefs((p) => ({ ...p, width: 280 }))}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  setPrefs((p) => ({
                    ...p,
                    width: Math.max(
                      220,
                      Math.min(
                        420,
                        p.width + (event.key === "ArrowRight" ? 20 : -20),
                      ),
                    ),
                  }));
                }
              }}
            />
          </div>
        </aside>
        <div data-onboarding-target="compendium.reader" className="cp-workspace-main">{children}</div>
      </div>
    </IndexContext.Provider>
  );
}
