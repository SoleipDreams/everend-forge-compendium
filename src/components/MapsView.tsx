import { useCompendiumText } from "./compendiumPresentation";
import { useEffect, useMemo, useState } from "react";
import type { Entity, SiteData } from "../types";
import { findMarkdownAssets } from "../lib/markdown";
import { stableSlug } from "../lib/paths";
import { isTauriRuntime, vaultAssetDataUrl } from "../tauriBridge";
import type { ReaderNavigation } from "./Reader";
import { useSurfaceMotion } from "../useSurfaceMotion";

type MapDefinition = {
  entity: Entity;
  imagePath?: string;
  pins: Entity[];
};

export function mapDefinitions(site: SiteData): MapDefinition[] {
  const maps = site.entities.filter(
    (entity) => stableSlug(entity.type) === "map",
  );
  return maps.map((entity) => ({
    entity,
    imagePath: findMarkdownAssets(entity.body)[0],
    pins: site.entities.filter(
      (candidate) =>
        candidate.map !== undefined &&
        (candidate.map === entity.id || candidate.map === entity.name) &&
        candidate.mapX !== undefined &&
        candidate.mapY !== undefined,
    ),
  }));
}

export function MapsView({
  site,
  navigate,
}: {
  site: SiteData;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  const maps = useMemo(() => mapDefinitions(site), [site]);
  const [activeId, setActiveId] = useState<string>();
  const active = maps.find((map) => map.entity.id === activeId) ?? maps[0];
  const surface = useSurfaceMotion<HTMLDivElement>(active?.entity.id);
  const [imageUrl, setImageUrl] = useState<string>();
  const [imageError, setImageError] = useState("");

  useEffect(() => {
    setImageUrl(undefined);
    setImageError("");
    if (!active?.imagePath) return;
    if (!isTauriRuntime()) {
      setImageError(
        t(
          "Map images load in the desktop app.",
          "Las imágenes de mapas se cargan en la aplicación de escritorio.",
        ),
      );
      return;
    }
    let disposed = false;
    void vaultAssetDataUrl(site.vaultPath, decodeURI(active.imagePath))
      .then((dataUrl) => {
        if (!disposed) setImageUrl(dataUrl);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setImageError(error instanceof Error ? error.message : String(error));
        }
      });
    return () => {
      disposed = true;
    };
  }, [active?.imagePath, site.vaultPath]);

  if (maps.length === 0) {
    return (
      <section className="page-title">
        <p className="chapter">{t("Maps", "Mapas")}</p>
        <h1>
          {t("No maps published yet.", "Todavía no hay mapas publicados.")}
        </h1>
        <p>
          {t("Create an entity with", "Crea una ficha con")}{" "}
          <code>type: Map</code>{" "}
          {t(
            "whose body embeds the map image. Other entities can pin themselves with",
            "e incluye la imagen del mapa en su contenido. Otras fichas pueden situarse mediante",
          )}{" "}
          <code>map</code>, <code>mapX</code>
          {t(", and", ", y")} <code>mapY</code>{" "}
          {t("(0–100) frontmatter.", "(0–100) en su frontmatter.")}{" "}
        </p>
      </section>
    );
  }

  return (
    <div ref={surface} className="maps-view">
      <header className="maps-header">
        <p className="chapter">{t("Atlas", "Atlas")}</p>
        <h1>{active.entity.name}</h1>
        {maps.length > 1 ? (
          <div className="maps-tabs" role="tablist">
            {maps.map((map) => (
              <button
                key={map.entity.id}
                type="button"
                role="tab"
                aria-selected={map.entity.id === active.entity.id}
                className={map.entity.id === active.entity.id ? "active" : ""}
                onClick={() => setActiveId(map.entity.id)}
              >
                {map.entity.name}
              </button>
            ))}
          </div>
        ) : null}
      </header>
      <div className="map-stage">
        {imageUrl ? (
          <div className="map-frame">
            <img src={imageUrl} alt={active.entity.name} />
            {active.pins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                className="map-pin"
                style={{ left: `${pin.mapX}%`, top: `${pin.mapY}%` }}
                title={pin.name}
                onClick={() => navigate(pin.route)}
              >
                <span className="map-pin-dot" />
                <span className="map-pin-label">{pin.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="map-placeholder">
            {active.imagePath
              ? imageError || t("Loading map…", "Cargando mapa…")
              : t(
                  "This map entity has no embedded image.",
                  "Esta ficha de mapa no tiene una imagen incrustada.",
                )}
          </div>
        )}
      </div>
      <footer className="maps-footer">
        <button type="button" onClick={() => navigate(active.entity.route)}>
          {t("Read about", "Leer sobre")} {active.entity.name}
        </button>
        <span>
          {active.pins.length} {t("pinned entries", "fichas situadas")}
        </span>
      </footer>
    </div>
  );
}
