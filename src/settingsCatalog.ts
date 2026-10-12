import type { SettingsPage } from "./settingsIntegration";

const catalog: Array<[string,string,string,string,string,boolean,Array<[string,string,string,string[]?]>]> = [
  [
    "general",
    "General",
    "General",
    "Language and appearance",
    "Idioma y apariencia",
    false,
    [
      [
        "locale",
        "Interface language",
        "Idioma de la interfaz"
      ],
      [
        "theme",
        "Theme",
        "Tema",
        [
          "Active style",
          "Estilo activo",
          "Style",
          "Estilo"
        ]
      ],
      [
        "mode",
        "Theme mode",
        "Modo del tema"
      ],
      [
        "ambient",
        "Soft background",
        "Fondo difuminado"
      ],
      [
        "scene",
        "Background scene",
        "Escena de fondo",
        ["Escena","Scene","Background image","Imagen de fondo"]
      ]
    ]
  ],
  [
    "universe",
    "Universe",
    "Universo",
    "Identity",
    "Identidad",
    true,
    [
      [
        "name",
        "Universe name",
        "Nombre del universo"
      ],
      [
        "icon",
        "Universe icon",
        "Icono del universo",
        [
          "Use book icon",
          "Usar icono libro"
        ]
      ]
    ]
  ],
  [
    "appearance",
    "Compendium",
    "Compendium",
    "Reading and publication",
    "Lectura y publicación",
    false,
    [
      [
        "font",
        "Primary typeface",
        "Fuente de lectura"
      ],
      [
        "publication",
        "Open publication workspace",
        "Abrir Publicación"
      ]
    ]
  ],
  [
    "about",
    "General",
    "General",
    "About Compendium",
    "Acerca de Compendium",
    false,
    [
      [
        "docs",
        "Documentation",
        "Documentación"
      ]
    ]
  ]
];
export const compendiumSettingsPages: SettingsPage[] = catalog.map(([id,groupEn,groupEs,titleEn,titleEs,requiresUniverse,controls]) => ({
  id: "compendium." + id, owner: "compendium", group: {en:groupEn,es:groupEs}, title: {en:titleEn,es:titleEs}, requiresUniverse,
  controls: controls.map(([control,en,es,match]) => ({ id: "compendium." + id + "." + control, label: {en,es}, match })),
}));

export function compendiumSettingsPage(section?: string) {
  const legacy: Record<string,string> = {"suite":"suite.language","update":"suite.update","app":"compendium.appearance"};
  return legacy[section ?? ""] ?? "compendium." + (section ?? "appearance");
}


compendiumSettingsPages.find(page => page.id === "compendium.general")!.controls.push({id:"compendium.general.interface-font",label:{en:"Interface typeface",es:"Fuente de interfaz"}});
