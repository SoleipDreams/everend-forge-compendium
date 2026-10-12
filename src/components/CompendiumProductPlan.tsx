import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  Download,
  Eye,
  FileText,
  Library,
  LockKeyhole,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCompendiumText } from "./compendiumPresentation";
import "../product-roadmap.css";

type Milestone = "1.0" | "2.0" | "3.0";
type Edition = "director" | "players";

const milestones: Array<{
  id: Milestone;
  title: string;
  short: string;
}> = [
  { id: "1.0", title: "Wiki integral", short: "Consulta" },
  { id: "2.0", title: "Ediciones para rol", short: "Campaña" },
  { id: "3.0", title: "Ensamblaje editorial", short: "Edición" },
];

const sourceNames: Record<string, { name: string; origin: string }> = {
  world: { name: "Atlas de Ceniza", origin: "WorldNotion · canon" },
  story: { name: "Las campanas bajo sal", origin: "PathBranching · historia" },
  interlude: {
    name: "Interludio: el farero",
    origin: "PathBranching · escena",
  },
};

export function CompendiumProductPlan({ onClose }: { onClose: () => void }) {
  const t = useCompendiumText();
  const [milestone, setMilestone] = useState<Milestone>("1.0");
  const [wikiRoute, setWikiRoute] = useState<"bridge" | "lighthouse">("bridge");
  const [edition, setEdition] = useState<Edition>("director");
  const [sourceOrder, setSourceOrder] = useState([
    "world",
    "story",
    "interlude",
  ]);
  const [selectedSources, setSelectedSources] = useState(["world", "story"]);
  const [editorialRoute, setEditorialRoute] = useState("bridge");
  const [includeReferences, setIncludeReferences] = useState(true);
  const [referenceMode, setReferenceMode] = useState<"endnotes" | "appendix">(
    "appendix",
  );
  const [format, setFormat] = useState("EPUB 3.3");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const orderedSources = useMemo(
    () => sourceOrder.filter((id) => selectedSources.includes(id)),
    [sourceOrder, selectedSources],
  );
  const moveSource = (id: string, delta: -1 | 1) => {
    setSourceOrder((current) => {
      const from = current.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  };

  const title = milestones.find((item) => item.id === milestone)?.title ?? "";

  return (
    <section
      className="cp-roadmap-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cp-roadmap-title"
    >
      <header className="cp-roadmap-topbar">
        <div className="cp-roadmap-brand">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Back to home", "Volver al inicio")}
          >
            <ArrowLeft size={17} />
          </button>
          <span className="cp-roadmap-mark">
            <Library size={17} />
          </span>
          <div>
            <strong>Compendium</strong>
            <small>{t("Product map", "Plan de producto")}</small>
          </div>
        </div>
        <div className="cp-roadmap-top-actions">
          <span className="cp-roadmap-prototype-tag">
            {t("Development mockup", "Maqueta de desarrollo")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close mockup", "Cerrar maqueta")}
          >
            <X size={17} />
          </button>
        </div>
      </header>

      <div className="cp-roadmap-content">
        <header className="cp-roadmap-intro">
          <div>
            <h1 id="cp-roadmap-title">
              {t(
                "A reading edition that grows with the work",
                "Una edición de lectura que crece con la obra",
              )}
            </h1>
            <p>
              {t(
                "From a complete universe wiki to separate campaign editions and carefully assembled books. Source material stays in WorldNotion and PathBranching.",
                "De una wiki integral del universo a ediciones de campaña separadas y libros ensamblados con cuidado. Las fuentes permanecen en WorldNotion y PathBranching.",
              )}
            </p>
          </div>
          <div className="cp-roadmap-source-note">
            <ShieldCheck size={16} />
            <span>
              {t(
                "Read-only sources · independent publications",
                "Fuentes de solo lectura · publicaciones independientes",
              )}
            </span>
          </div>
        </header>

        <nav
          className="cp-roadmap-milestones"
          aria-label={t("Compendium milestones", "Hitos de Compendium")}
        >
          {milestones.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={milestone === item.id ? "active" : ""}
              aria-current={milestone === item.id ? "step" : undefined}
              onClick={() => {
                setMilestone(item.id);
                setNotice("");
              }}
            >
              <span className="cp-roadmap-step-number">0{index + 1}</span>
              <span>
                <strong>
                  {item.id} · {item.title}
                </strong>
                <small>{item.short}</small>
              </span>
              {index < milestones.length - 1 ? (
                <ArrowRight size={16} aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </nav>

        <div className="cp-roadmap-stage-heading">
          <div>
            <h2>
              {milestone} · {title}
            </h2>
            <p>
              {milestone === "1.0" &&
                t(
                  "Read local canon, follow published paths, and inspect what a profile includes.",
                  "Consulta el canon local, sigue rutas publicadas y revisa qué incluye cada perfil.",
                )}
              {milestone === "2.0" &&
                t(
                  "Prepare two independent editions with a preview for each audience.",
                  "Prepara dos ediciones independientes y una vista previa para cada público.",
                )}
              {milestone === "3.0" &&
                t(
                  "Assemble source references into a chosen reading order and export profile.",
                  "Ensambla referencias a las fuentes en un orden de lectura y perfil de salida.",
                )}
            </p>
          </div>
          <span className="cp-roadmap-stage-status">
            {t("Product objective", "Objetivo de producto")}
          </span>
        </div>

        {milestone === "1.0" ? (
          <section
            className="cp-roadmap-demo cp-roadmap-wiki"
            aria-label={t("Wiki mockup", "Maqueta de wiki")}
          >
            <aside className="cp-roadmap-demo-rail">
              <div className="cp-roadmap-universe">
                <span className="cp-roadmap-universe-mark">A</span>
                <span>
                  <strong>Atlas de Ceniza</strong>
                  <small>{t("Universe wiki", "Wiki del universo")}</small>
                </span>
              </div>
              <button type="button" className="selected">
                <Library size={15} />
                {t("Encyclopedia", "Enciclopedia")}
              </button>
              <button type="button">
                <BookOpen size={15} />
                {t("Stories", "Historias")}
              </button>
              <div className="cp-roadmap-rail-label">
                {t("IN THIS STORY", "EN ESTA HISTORIA")}
              </div>
              <span className="cp-roadmap-rail-link">
                01 · {t("The drowned bell", "La campana sumergida")}
              </span>
              <span className="cp-roadmap-rail-link active">
                02 · {t("The north pier", "El muelle norte")}
              </span>
              <span className="cp-roadmap-rail-link">
                03 · {t("The lighthouse keeper", "El farero")}
              </span>
              <div className="cp-roadmap-profile">
                <span>{t("Publication profile", "Perfil de publicación")}</span>
                <strong>Lectura pública</strong>
                <small>
                  <Check size={12} /> canon · 18 fichas
                </small>
              </div>
            </aside>
            <div className="cp-roadmap-demo-main">
              <div className="cp-roadmap-breadcrumb">
                Atlas de Ceniza <span>/</span> {t("Stories", "Historias")}{" "}
                <span>/</span> Las campanas bajo sal
              </div>
              <article className="cp-roadmap-story-page">
                <p className="cp-roadmap-chapter">
                  {t("SCENE 02 · NORTH PIER", "ESCENA 02 · MUELLE NORTE")}
                </p>
                <h3>
                  {t("A light beneath the water", "Una luz bajo el agua")}
                </h3>
                <p>
                  {wikiRoute === "bridge"
                    ? t(
                        "The tide draws back from the old bridge. A pale light moves below the black water, keeping pace with the bell's last echo.",
                        "La marea se retira del puente viejo. Una luz pálida avanza bajo el agua negra, al ritmo del último eco de la campana.",
                      )
                    : t(
                        "At the lighthouse door, the keeper waits with a dry lantern and salt on his sleeves. He recognizes the mark on your map.",
                        "Ante la puerta del faro, el farero espera con un farol seco y sal en las mangas. Reconoce la marca de tu mapa.",
                      )}
                </p>
                <div className="cp-roadmap-wiki-choices">
                  <span>
                    {t("Choose a published route", "Elige una ruta publicada")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setWikiRoute("bridge")}
                    className={wikiRoute === "bridge" ? "active" : ""}
                  >
                    <span>01</span>
                    <strong>
                      {t(
                        "Follow the light beneath the bridge",
                        "Seguir la luz bajo el puente",
                      )}
                    </strong>
                    <ArrowRight size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setWikiRoute("lighthouse")}
                    className={wikiRoute === "lighthouse" ? "active" : ""}
                  >
                    <span>02</span>
                    <strong>
                      {t(
                        "Ask the keeper about the map",
                        "Preguntar al farero por el mapa",
                      )}
                    </strong>
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div className="cp-roadmap-rule-note">
                  <LockKeyhole size={14} />
                  <span>
                    {t(
                      "A third option depends on a story rule. It is omitted and reported in diagnostics.",
                      "Una tercera opción depende de una regla de historia. Se omite y aparece en el diagnóstico.",
                    )}
                  </span>
                </div>
              </article>
              <aside className="cp-roadmap-wiki-info">
                <div>
                  <span>{t("CANON REFERENCES", "REFERENCIAS AL CANON")}</span>
                  <strong>El puente sumergido</strong>
                  <small>Location · canon</small>
                </div>
                <div>
                  <span>
                    {t("PUBLICATION CHECK", "REVISIÓN DE PUBLICACIÓN")}
                  </span>
                  <strong className="ok">
                    <Check size={13} />
                    {t("Profile ready", "Perfil listo")}
                  </strong>
                  <small>
                    {t(
                      "1 conditional route omitted",
                      "1 ruta condicional omitida",
                    )}
                  </small>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {milestone === "2.0" ? (
          <section
            className="cp-roadmap-demo cp-roadmap-role"
            aria-label={t(
              "Role editions mockup",
              "Maqueta de ediciones para rol",
            )}
          >
            <aside className="cp-roadmap-edition-sidebar">
              <div className="cp-roadmap-demo-title">
                <span>{t("CAMPAIGN", "CAMPAÑA")}</span>
                <strong>Las campanas bajo sal</strong>
                <small>Northwatch · 4 sesiones</small>
              </div>
              <button
                type="button"
                className={edition === "director" ? "selected" : ""}
                onClick={() => setEdition("director")}
              >
                <Eye size={16} />
                <span>
                  <strong>
                    {t("Director edition", "Edición de dirección")}
                  </strong>
                  <small>
                    {t(
                      "Full context and secrets",
                      "Contexto completo y secretos",
                    )}
                  </small>
                </span>
              </button>
              <button
                type="button"
                className={edition === "players" ? "selected" : ""}
                onClick={() => setEdition("players")}
              >
                <BookOpen size={16} />
                <span>
                  <strong>{t("Player edition", "Edición de jugadores")}</strong>
                  <small>
                    {t("Shared canon and clues", "Canon compartido y pistas")}
                  </small>
                </span>
              </button>
              <div className="cp-roadmap-private-note">
                <LockKeyhole size={14} />
                <span>
                  {t(
                    "Each edition is built separately.",
                    "Cada edición se genera por separado.",
                  )}
                </span>
              </div>
            </aside>
            <div className="cp-roadmap-role-preview">
              <div className="cp-roadmap-preview-toolbar">
                <span>
                  <Eye size={14} />
                  {t("PREVIEW", "VISTA PREVIA")}
                </span>
                <div>
                  <button
                    type="button"
                    className={edition === "director" ? "active" : ""}
                    onClick={() => setEdition("director")}
                  >
                    {t("Director", "Dirección")}
                  </button>
                  <button
                    type="button"
                    className={edition === "players" ? "active" : ""}
                    onClick={() => setEdition("players")}
                  >
                    {t("Players", "Jugadores")}
                  </button>
                </div>
              </div>
              <article>
                <div className="cp-roadmap-cover-art">
                  <span>NW</span>
                  <small>NORTHWATCH · CAMPAIGN GUIDE</small>
                </div>
                <div className="cp-roadmap-role-copy">
                  <p className="cp-roadmap-chapter">
                    {edition === "director"
                      ? t(
                          "DIRECTOR NOTES · SESSION 02",
                          "NOTAS DE DIRECCIÓN · SESIÓN 02",
                        )
                      : t(
                          "PLAYER EDITION · SESSION 02",
                          "EDICIÓN DE JUGADORES · SESIÓN 02",
                        )}
                  </p>
                  <h3>
                    {t("The bell under the salt", "La campana bajo la sal")}
                  </h3>
                  <p>
                    {t(
                      "The old bridge appears only at low tide. Three iron rings mark the steps into the water.",
                      "El puente viejo solo aparece durante la marea baja. Tres anillos de hierro marcan los escalones hacia el agua.",
                    )}
                  </p>
                  {edition === "director" ? (
                    <div className="cp-roadmap-secret">
                      <LockKeyhole size={14} />
                      <span>
                        <strong>
                          {t("Hidden from players", "Oculto para jugadores")}
                        </strong>
                        {t(
                          "The keeper has already sold the map. His lantern contains the original seal.",
                          "El farero ya vendió el mapa. Su farol guarda el sello original.",
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="cp-roadmap-player-clue">
                      <span>{t("CLUE", "PISTA")}</span>
                      <strong>
                        {t(
                          "The lantern is warm, though it has no flame.",
                          "El farol está tibio, aunque no tiene llama.",
                        )}
                      </strong>
                    </div>
                  )}
                </div>
              </article>
              <div className="cp-roadmap-build-row">
                <div>
                  <strong>
                    {edition === "director"
                      ? "northwatch-director.zip"
                      : "northwatch-players.zip"}
                  </strong>
                  <small>
                    {t(
                      "Standalone static edition · profile v1",
                      "Edición estática independiente · perfil v1",
                    )}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNotice(
                      t(
                        "Mockup only · no package was created.",
                        "Solo maqueta · no se generó ningún paquete.",
                      ),
                    )
                  }
                >
                  <Download size={15} />
                  {t("Build edition", "Generar edición")}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {milestone === "3.0" ? (
          <section
            className="cp-roadmap-demo cp-roadmap-editorial"
            aria-label={t(
              "Editorial assembly mockup",
              "Maqueta de ensamblaje editorial",
            )}
          >
            <aside className="cp-roadmap-source-picker">
              <div className="cp-roadmap-demo-title">
                <span>{t("SOURCE LIBRARY", "BIBLIOTECA DE FUENTES")}</span>
                <strong>{t("Atlas de Ceniza", "Atlas de Ceniza")}</strong>
                <small>
                  {t(
                    "References only · source text stays in place",
                    "Solo referencias · el texto fuente permanece en su sitio",
                  )}
                </small>
              </div>
              {Object.entries(sourceNames).map(([id, source]) => (
                <label key={id} className="cp-roadmap-source-row">
                  <input
                    type="checkbox"
                    checked={selectedSources.includes(id)}
                    onChange={(event) =>
                      setSelectedSources((current) =>
                        event.target.checked
                          ? [...current, id]
                          : current.filter((item) => item !== id),
                      )
                    }
                  />
                  <span>
                    <strong>{source.name}</strong>
                    <small>{source.origin}</small>
                  </span>
                  {selectedSources.includes(id) ? <Check size={14} /> : null}
                </label>
              ))}
              <div className="cp-roadmap-source-owner">
                <LockKeyhole size={13} />
                <span>
                  {t(
                    "Compendium cannot edit these sources.",
                    "Compendium no puede editar estas fuentes.",
                  )}
                </span>
              </div>
            </aside>
            <div className="cp-roadmap-editorial-workspace">
              <div className="cp-roadmap-editorial-controls">
                <div className="cp-roadmap-editor-block">
                  <h3>{t("Reading order", "Orden de lectura")}</h3>
                  <p>
                    {t(
                      "Move selected source references into the edition order.",
                      "Ordena las referencias seleccionadas para esta edición.",
                    )}
                  </p>
                  <ol className="cp-roadmap-order-list">
                    {orderedSources.map((id, index) => (
                      <li key={id}>
                        <span className="cp-roadmap-order-index">
                          0{index + 1}
                        </span>
                        <span>
                          <strong>{sourceNames[id].name}</strong>
                          <small>{sourceNames[id].origin}</small>
                        </span>
                        <div>
                          <button
                            type="button"
                            aria-label={t(
                              `Move ${sourceNames[id].name} up`,
                              `Subir ${sourceNames[id].name}`,
                            )}
                            disabled={index === 0}
                            onClick={() => moveSource(id, -1)}
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            aria-label={t(
                              `Move ${sourceNames[id].name} down`,
                              `Bajar ${sourceNames[id].name}`,
                            )}
                            disabled={index === orderedSources.length - 1}
                            onClick={() => moveSource(id, 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="cp-roadmap-editor-block cp-roadmap-options-block">
                  <label>
                    <span>
                      {t("Chosen narrative route", "Ruta narrativa elegida")}
                    </span>
                    <select
                      value={editorialRoute}
                      onChange={(event) =>
                        setEditorialRoute(event.target.value)
                      }
                    >
                      <option value="bridge">
                        {t(
                          "Follow the light beneath the bridge",
                          "Seguir la luz bajo el puente",
                        )}
                      </option>
                      <option value="lighthouse">
                        {t(
                          "Ask the keeper about the map",
                          "Preguntar al farero por el mapa",
                        )}
                      </option>
                    </select>
                  </label>
                  <label className="cp-roadmap-ref-toggle">
                    <input
                      type="checkbox"
                      checked={includeReferences}
                      onChange={(event) =>
                        setIncludeReferences(event.target.checked)
                      }
                    />
                    <span>
                      <strong>
                        {t(
                          "Add canon references",
                          "Añadir referencias al canon",
                        )}
                      </strong>
                      <small>
                        {t(
                          "Optional notes or appendix",
                          "Notas o apéndice opcionales",
                        )}
                      </small>
                    </span>
                  </label>
                  <label>
                    <span>
                      {t("Reference placement", "Ubicación de referencias")}
                    </span>
                    <select
                      value={referenceMode}
                      disabled={!includeReferences}
                      onChange={(event) =>
                        setReferenceMode(
                          event.target.value as "endnotes" | "appendix",
                        )
                      }
                    >
                      <option value="endnotes">
                        {t("Endnotes", "Notas al final")}
                      </option>
                      <option value="appendix">
                        {t("Appendix", "Apéndice")}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>{t("Template", "Plantilla")}</span>
                    <select defaultValue="novel">
                      <option value="novel">
                        {t(
                          "Novel · compact chapter",
                          "Novela · capítulo compacto",
                        )}
                      </option>
                      <option value="screenplay">
                        {t(
                          "Screenplay · Fountain",
                          "Guion audiovisual · Fountain",
                        )}
                      </option>
                      <option value="theatre">
                        {t(
                          "Theatre · rehearsal copy",
                          "Teatro · copia de ensayo",
                        )}
                      </option>
                    </select>
                  </label>
                  <label>
                    <span>{t("Output format", "Formato de salida")}</span>
                    <select
                      value={format}
                      onChange={(event) => setFormat(event.target.value)}
                    >
                      <option>EPUB 3.3</option>
                      <option>DOCX</option>
                      <option>PDF · lectura</option>
                      <option>PDF · imprenta</option>
                      <option>Fountain</option>
                      <option>PDF · plantilla de teatro</option>
                      <option>DOCX · plantilla de teatro</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="cp-roadmap-editorial-preview">
                <div className="cp-roadmap-preview-toolbar">
                  <span>
                    <FileText size={14} />
                    {t("EDITION PREVIEW", "VISTA PREVIA DE EDICIÓN")}
                  </span>
                  <button
                    type="button"
                    className={previewOpen ? "active" : ""}
                    onClick={() => setPreviewOpen((current) => !current)}
                  >
                    <Eye size={14} />
                    {previewOpen
                      ? t("Hide preview", "Ocultar vista previa")
                      : t("Preview", "Vista previa")}
                  </button>
                </div>
                <article className="cp-roadmap-book-page">
                  <p className="cp-roadmap-chapter">
                    ATLAS DE CENIZA · {t("EXCERPT", "FRAGMENTO")}
                  </p>
                  <h3>
                    {editorialRoute === "bridge"
                      ? t(
                          "The light beneath the bridge",
                          "La luz bajo el puente",
                        )
                      : t("The keeper's map", "El mapa del farero")}
                  </h3>
                  <p>
                    {editorialRoute === "bridge"
                      ? t(
                          "The tide fell away from the stones. Below the bridge, a pale light moved against the current.",
                          "La marea se apartó de las piedras. Bajo el puente, una luz pálida avanzó contra la corriente.",
                        )
                      : t(
                          "The keeper turned the lantern in his hands. Beneath the salt, the old seal caught a thread of light.",
                          "El farero giró el farol entre las manos. Bajo la sal, el sello antiguo atrapó un hilo de luz.",
                        )}
                  </p>
                  {previewOpen ? (
                    <div className="cp-roadmap-preview-details">
                      <Route size={14} />
                      <span>
                        {orderedSources.length}{" "}
                        {t("source references", "referencias de fuente")} ·{" "}
                        {includeReferences
                          ? referenceMode === "appendix"
                            ? t(
                                "canon appendix included",
                                "apéndice de canon incluido",
                              )
                            : t(
                                "canon endnotes included",
                                "notas de canon incluidas",
                              )
                          : t(
                              "no canon references",
                              "sin referencias al canon",
                            )}{" "}
                        · {format}
                      </span>
                    </div>
                  ) : null}
                </article>
                <footer>
                  <span>
                    {t(
                      "Profile: Northwatch novel · v1",
                      "Perfil: Novela de Northwatch · v1",
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNotice(
                        t(
                          `Mockup only · ${format} export is not connected yet.`,
                          `Solo maqueta · la exportación ${format} aún no está conectada.`,
                        ),
                      )
                    }
                  >
                    <Download size={14} />
                    {t("Export", "Exportar")}
                  </button>
                </footer>
              </div>
            </div>
          </section>
        ) : null}

        {notice ? (
          <p className="cp-roadmap-notice" role="status">
            {notice}
            <button type="button" onClick={() => setNotice("")}>
              {t("Dismiss", "Cerrar")}
            </button>
          </p>
        ) : null}

        <footer className="cp-roadmap-footer">
          <span>
            {t(
              "Synthetic universe · medium fidelity · no source files are changed",
              "Universo sintético · fidelidad media · no se modifican fuentes",
            )}
          </span>
          <button type="button" onClick={onClose}>
            {t("Return to Compendium", "Volver a Compendium")}
            <ArrowRight size={15} />
          </button>
        </footer>
      </div>
    </section>
  );
}
