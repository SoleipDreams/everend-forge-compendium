import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { SiteData } from "../types";

export const CompendiumLocale = createContext<"en" | "es">("en");
export function useCompendiumText() {
  const locale = useContext(CompendiumLocale);
  return (en: string, es: string) => (locale === "es" ? es : en);
}
export const IndexContext = createContext<(type: string) => void>(() => {});
export const useOpenCompendiumIndex = () => useContext(IndexContext);

export function CompendiumGroup({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(() => {
    try {
      const value = sessionStorage.getItem(`compendium.group.${id}`);
      return value === null ? defaultOpen : value === "true";
    } catch {
      return defaultOpen;
    }
  });
  return (
    <details
      className="cp-content-group"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        try {
          sessionStorage.setItem(`compendium.group.${id}`, String(next));
        } catch {
          /* UI preference only. */
        }
      }}
    >
      <summary>{title}</summary>
      <div>{children}</div>
    </details>
  );
}

export function orderedTypes(site: SiteData) {
  const order = site.config.navigation?.typeOrder ?? [];
  return [...new Set(site.entities.map((entity) => entity.type))].sort(
    (a, b) => {
      return (
        (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) ||
        a.localeCompare(b)
      );
    },
  );
}

/** Native details keyboard behavior plus dismiss/focus restoration. */
export function CompendiumMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node) && root.current)
        root.current.open = false;
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <details
      ref={root}
      className="reader-view-options"
      onKeyDown={(event) => {
        if (event.key === "Escape" && root.current?.open) {
          event.preventDefault();
          event.stopPropagation();
          root.current.open = false;
          root.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>{label}</summary>
      <div className="reader-view-options-content">{children}</div>
    </details>
  );
}

/** Translate only generated UI diagnostics; paths, IDs and authored names stay verbatim. */
export function formatCompendiumDiagnostic(
  message: string,
  locale: "en" | "es",
) {
  if (locale !== "es") return message;
  const replacements: Array<[RegExp, string]> = [
    [
      /^Vault path does not exist: (.+)$/,
      "No existe la carpeta del universo: $1",
    ],
    [
      /^Vault path is not a directory: (.+)$/,
      "La ruta del universo no es una carpeta: $1",
    ],
    [/^Vault path does not exist\.$/, "No existe la carpeta del universo."],
    [
      /^Path may not traverse outside the vault\.$/,
      "La ruta no puede salir del universo.",
    ],
    [/^Path may not be empty\.$/, "La ruta no puede estar vacía."],
    [/^Path is not a file\.$/, "La ruta no corresponde a un archivo."],
    [
      /^File is too large to preview \(limit 10 MB\)\.$/,
      "El archivo supera el límite de 10 MB para la vista previa.",
    ],
    [/^(.+) must be an object\.$/, "$1 debe contener un objeto."],
    [
      /^(.+) must set profileVersion: 1\.$/,
      "$1 debe declarar profileVersion: 1.",
    ],
    [
      /^(.+) is missing required entity frontmatter\.$/,
      "$1 no incluye los metadatos obligatorios de la ficha.",
    ],
    [
      /^(.+) has duplicate entity id (.+)\.$/,
      "$1 tiene un ID de ficha duplicado: $2.",
    ],
    [
      /^Profile references unknown entity (.+)\.$/,
      "El perfil hace referencia a una ficha desconocida: $1.",
    ],
    [
      /^Profile references unknown story (.+)\.$/,
      "El perfil hace referencia a una historia desconocida: $1.",
    ],
    [
      /^Profile references unknown sequence (.+)\.$/,
      "El perfil hace referencia a una secuencia desconocida: $1.",
    ],
    [
      /^Profile references unknown event (.+)\.$/,
      "El perfil hace referencia a un evento desconocido: $1.",
    ],
    [
      /^Could not resolve published reference (.+)\.$/,
      "No se pudo resolver la referencia publicada: $1.",
    ],
    [
      /^Excluded dependency (.+) is referenced by published content\.$/,
      "El contenido publicado menciona una dependencia excluida: $1.",
    ],
    [
      /^Route collision between (.+) and (.+): (.+)$/,
      "Conflicto de ruta entre $1 y $2: $3",
    ],
    [
      /^Ignored an invalid PathBranching story manifest entry\.$/,
      "Se omitió una entrada inválida del manifiesto de historias de PathBranching.",
    ],
    [
      /^Could not read PathBranching story (.+)\.$/,
      "No se pudo leer la historia de PathBranching: $1.",
    ],
    [
      /^Could not read sequence (.+) in (.+)\.$/,
      "No se pudo leer la secuencia $1 de $2.",
    ],
    [
      /^Conditional narrative options were omitted because Compendium does not evaluate story rules\.$/,
      "Se omitieron opciones narrativas condicionales; Compendium no evalúa reglas de historia.",
    ],
    [
      /^A narrative option points to a missing destination and was omitted\.$/,
      "Se omitió una opción narrativa porque su destino no existe.",
    ],
    [
      /^A narrative option points to an unavailable destination and was omitted\.$/,
      "Se omitió una opción narrativa porque su destino no está disponible para esta publicación.",
    ],
    [
      /^A narrative option from "(.+)" was omitted because its destination is not included in this publication\.$/,
      'Se omitió una opción narrativa de "$1" porque su destino no está incluido en esta publicación.',
    ],
    [
      /^(.+) must set specVersion: "0.1"\.$/,
      '$1 debe declarar specVersion: "0.1".',
    ],
    [
      /^(.+) publication.statuses cannot be empty\.$/,
      "$1 no puede tener publication.statuses vacío.",
    ],
    [
      /^(.+) has an unsupported narrative mode\.$/,
      "$1 tiene un modo narrativo incompatible.",
    ],
    [/^(.+) must be valid JSON: (.+)$/, "$1 debe contener JSON válido: $2"],
  ];
  for (const [pattern, replacement] of replacements)
    if (pattern.test(message)) return message.replace(pattern, replacement);
  return message;
}
export function useCompendiumDiagnosticText() {
  const locale = useContext(CompendiumLocale);
  return (message: string) => formatCompendiumDiagnostic(message, locale);
}
