import { useCompendiumDiagnosticText } from "./compendiumPresentation";
import { useCompendiumText } from "./compendiumPresentation";
import { useOpenCompendiumIndex } from "./compendiumPresentation";
import { useEffect, useState } from "react";
import type { SiteData } from "../types";
import { isTauriRuntime, vaultAssetDataUrl } from "../tauriBridge";
import type { ReaderNavigation } from "./Reader";
import { orderedTypes } from "./compendiumPresentation";

export function CoverPage({
  site,
  navigate,
}: {
  site: SiteData;
  navigate: ReaderNavigation;
}) {
  const t = useCompendiumText();
  const diagnosticText = useCompendiumDiagnosticText();
  const openIndex = useOpenCompendiumIndex();
  const featured = site.entities[0];
  const [coverUrl, setCoverUrl] = useState<string>();
  const coverImage = site.config.site?.coverImage;

  useEffect(() => {
    setCoverUrl(undefined);
    if (!coverImage || !isTauriRuntime()) return;
    let disposed = false;
    void vaultAssetDataUrl(site.vaultPath, coverImage)
      .then((dataUrl) => {
        if (!disposed) setCoverUrl(dataUrl);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [coverImage, site.vaultPath]);

  const types = orderedTypes(site);
  return (
    <>
      <section
        className="cover"
        style={
          coverUrl
            ? {
                backgroundImage: `linear-gradient(90deg, rgba(3,18,29,.9), rgba(3,18,29,.2)), url('${coverUrl}')`,
              }
            : undefined
        }
      >
        <div>
          <p className="chapter">
            {t("The living archive", "El archivo vivo")}
          </p>
          <h1>{site.title}</h1>
          <p>{site.description}</p>
          {featured ? (
            <button
              type="button"
              className="action"
              onClick={() => navigate(featured.route)}
            >
              {t("Begin reading", "Comenzar a leer")}{" "}
            </button>
          ) : null}
        </div>
      </section>
      <section className="intro">
        <p className="kicker">
          {t("A world in reference", "Un mundo para consultar")}
        </p>
        <h2>
          {t(
            "Every person, place, and story in one readable edition.",
            "Personas, lugares e historias en una misma edición de lectura.",
          )}
        </h2>
        <p>
          {t(
            "This Compendium is generated from portable Markdown canon and editorial story scenes. Follow links, explore related entries, or search the archive.",
            "Este Compendium reúne el canon en Markdown y las escenas narrativas. Sigue los enlaces, explora fichas relacionadas o busca en el archivo.",
          )}{" "}
        </p>
      </section>
      <section className="directory">
        <h2>{t("Browse the archive", "Explorar el archivo")}</h2>
        <div className="type-list">
          {types.map((type) => {
            return (
              <button key={type} type="button" onClick={() => openIndex(type)}>
                <span>{type}</span>
                <strong>
                  {
                    site.entities.filter((entity) => entity.type === type)
                      .length
                  }
                </strong>
              </button>
            );
          })}
        </div>
      </section>
      {site.warnings.length > 0 ? (
        <section className="warnings">
          <h2>{t("Warnings", "Avisos")}</h2>
          <ul>
            {site.warnings.map((warning) => (
              <li key={warning}>{diagnosticText(warning)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
