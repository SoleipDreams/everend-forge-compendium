import { learningText as t, type LearningStep, type LearningLesson } from "./learning";
const step = (id: string, title: [string, string], body: [string, string], section: string, target: string, event?: string, character: "brio" | "temple" = "temple"): LearningStep =>
  ({ id, title: t(...title), body: t(...body), section, target, event, character });
export const compendiumIntroduction = [
  step("read", ["Tu mundo, para leer", "Your world, for reading"], ["Compendium reúne las notas y las historias disponibles del universo en una edición de lectura.", "Compendium brings the universe's available notes and stories together in a reading edition."], "reading", "compendium.reader"),
  step("organize", ["Elige qué compartir", "Choose what to share"], ["Publicación organiza los perfiles y la selección de contenido. Una edición puede mostrar una parte de tu universo.", "Publication organizes profiles and content selection. An edition can show just part of your universe."], "publication", "compendium.publication"),
  step("output", ["Revisa antes de compartir", "Review before sharing"], ["Comprueba la vista previa y los diagnósticos. El botón Copiar comando ZIP prepara el comando de empaquetado; el archivo se genera al ejecutarlo.", "Check the preview and diagnostics. Copy ZIP command prepares the packaging command; running it generates the file."], "publication", "compendium.export"),
];
export const compendiumLessons: LearningLesson[] = [
  { id: "reading", title: t("Explorar el contenido", "Explore the content"), summary: t("Encuentra una ficha o una historia.", "Find an entry or a story."), section: "reading", steps: [
    step("read", ["Entra en tu mundo", "Enter your world"], ["Abre una ficha o historia desde el índice de lectura. Puedes volver al índice cuando quieras.", "Open an entry or story from the reading index. You can return to the index at any time."], "reading", "compendium.reader", "content-opened", "brio"),
  ] },
  { id: "profile", title: t("Configurar un perfil", "Configure a profile"), summary: t("Guarda una edición para tu público.", "Save an edition for your audience."), section: "publication", steps: [
    step("save", ["Una edición con nombre", "An edition with a name"], ["En Publicación, crea o modifica un perfil y guárdalo. Puedes conservar los perfiles existentes.", "In Publication, create or edit a profile and save it. You can keep existing profiles."], "publication", "compendium.publication", "profile-saved"),
  ] },
  { id: "selection", title: t("Seleccionar y revisar", "Select and review"), summary: t("Comprueba qué verá el lector.", "Check what the reader will see."), section: "publication", steps: [
    step("selection", ["Decide qué entra", "Choose what goes in"], ["Cambia la inclusión o exclusión de una ficha o historia en el perfil. Guarda antes de continuar.", "Change an entry or story's inclusion or exclusion in the profile. Save before continuing."], "publication", "compendium.publication", "selection-saved"),
    step("preview", ["Mira la edición", "See the edition"], ["Abre Vista previa para consultar el contenido seleccionado. Revisa los avisos antes de preparar la salida.", "Open Preview to read the selected content. Review warnings before preparing output."], "publication", "compendium.preview", "publication-previewed"),
    step("diagnostics", ["Revisa los avisos", "Review the warnings"], ["Abre Diagnósticos. Comprueba referencias, archivos y contenido excluido; los avisos explican qué debes revisar.", "Open Diagnostics. Check references, files and excluded content; warnings explain what needs review."], "diagnostics", "compendium.diagnostics", "diagnostics-opened"),
  ] },
  { id: "output", title: t("Preparar la salida ZIP", "Prepare ZIP output"), summary: t("Obtén el comando para empaquetar tu edición.", "Get the command to package your edition."), section: "publication", steps: [
    step("command", ["Prepara el paquete", "Prepare the package"], ["Usa Copiar comando ZIP. Se guardará el perfil y se copiará el comando. Ejecútalo en una terminal con la CLI de Compendium para generar el ZIP; esta guía confirma la preparación, no la creación del archivo.", "Use Copy ZIP command. The profile is saved and the command copied. Run it in a terminal with the Compendium CLI to generate the ZIP; this guide confirms preparation, not file creation."], "publication", "compendium.export", "zip-command-copied"),
  ] },
];
