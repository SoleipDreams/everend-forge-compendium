import {
  learningText as t,
  type LearningStep,
  type LearningLesson,
} from "./learning";

const step = (
  id: string,
  title: [string, string],
  body: [string, string],
  section: string,
  target: string,
  character: "brio" | "temple" = "temple",
): LearningStep => ({
  id,
  title: t(...title),
  body: t(...body),
  section,
  target,
  character,
});

export const compendiumIntroduction = [
  step(
    "read",
    ["Tu mundo, para leer", "Your world, for reading"],
    [
      "Compendium reúne las entidades y las historias disponibles del universo en una edición de lectura. El Índice y el lector ayudan a explorarla.",
      "Compendium brings the universe's available entities and stories together in a reading edition. The Index and reader help you explore it.",
    ],
    "reading",
    "compendium.reader",
  ),
  step(
    "organize",
    ["Elige qué compartir", "Choose what to share"],
    [
      "Publicación organiza los perfiles y la selección de contenido. Una edición puede mostrar solo una parte de tu universo.",
      "Publication organizes profiles and content selection. An edition can show just part of your universe.",
    ],
    "publication",
    "compendium.publication",
  ),
  step(
    "output",
    ["Revisa antes de compartir", "Review before sharing"],
    [
      "Vista previa y Diagnósticos ayudan a revisar la edición. Copiar comando ZIP prepara un comando para la CLI; no crea el archivo por sí solo.",
      "Preview and Diagnostics help review an edition. Copy ZIP command prepares a CLI command; it does not create the file by itself.",
    ],
    "publication",
    "compendium.export",
  ),
];

export const compendiumLessons: LearningLesson[] = [
  {
    id: "reading",
    title: t("Explorar la edición", "Explore the edition"),
    summary: t(
      "Ubica el índice, las historias y el lector.",
      "Locate the index, stories and reader.",
    ),
    section: "reading",
    steps: [
      step(
        "read",
        ["Índice y lector", "Index and reader"],
        [
          "Índice reúne las entidades disponibles; Historias contiene los relatos publicados. Abrir una entrada la muestra en el lector. No necesitas seleccionar contenido para conocer esta vista.",
          "Index contains the available entities; Stories contains published narratives. Opening an entry displays it in the reader. You do not need to select content for this tour.",
        ],
        "reading",
        "compendium.reader",
        "brio",
      ),
    ],
  },
  {
    id: "profile",
    title: t("Perfiles de publicación", "Publication profiles"),
    summary: t(
      "Conoce dónde se configuran las ediciones.",
      "See where editions are configured.",
    ),
    section: "publication",
    steps: [
      step(
        "save",
        ["Un perfil para cada público", "A profile for each audience"],
        [
          "Publicación muestra perfiles con nombre y los ajustes de cada edición. Puedes crear perfiles distintos para públicos diferentes; no necesitas guardar cambios para continuar.",
          "Publication shows named profiles and each edition's settings. You can create different profiles for different audiences; you do not need to save changes to continue.",
        ],
        "publication",
        "compendium.publication",
      ),
    ],
  },
  {
    id: "selection",
    title: t("Selección y revisión", "Selection and review"),
    summary: t(
      "Ubica inclusión, vista previa y diagnósticos.",
      "Locate inclusion, preview and diagnostics.",
    ),
    section: "publication",
    steps: [
      step(
        "selection",
        ["Qué incluye el perfil", "What a profile includes"],
        [
          "Los controles de inclusión de Publicación indican qué entidades e historias aparecen en el perfil. Cambiar una selección es opcional en este recorrido.",
          "Publication's inclusion controls show which entities and stories appear in a profile. Changing a selection is optional in this tour.",
        ],
        "publication",
        "compendium.publication",
      ),
      step(
        "preview",
        ["Vista previa", "Preview"],
        [
          "Vista previa muestra la edición tal como la leería su público. Desde aquí puedes recorrer el contenido que incluya el perfil activo.",
          "Preview shows an edition as its audience would read it. From here, you can browse the content included in the active profile.",
        ],
        "publication",
        "compendium.preview",
      ),
      step(
        "diagnostics",
        ["Avisos antes de publicar", "Warnings before publishing"],
        [
          "Diagnósticos reúne referencias, archivos y contenido excluido que conviene revisar. Abrir esta sección no cambia la edición.",
          "Diagnostics collects references, files and excluded content that may need review. Opening this section does not change the edition.",
        ],
        "diagnostics",
        "compendium.diagnostics",
      ),
    ],
  },
  {
    id: "output",
    title: t("Preparar una salida ZIP", "Prepare ZIP output"),
    summary: t(
      "Ubica la salida y conoce cómo se genera el archivo.",
      "Locate output and learn how the file is generated.",
    ),
    section: "publication",
    steps: [
      step(
        "command",
        ["Comando para empaquetar", "Packaging command"],
        [
          "Copiar comando ZIP prepara la instrucción para la CLI de Compendium. El ZIP se genera al ejecutar ese comando en una terminal; esta guía solo señala dónde se prepara.",
          "Copy ZIP command prepares an instruction for the Compendium CLI. The ZIP is generated by running that command in a terminal; this tour only shows where to prepare it.",
        ],
        "publication",
        "compendium.export",
      ),
    ],
  },
];
