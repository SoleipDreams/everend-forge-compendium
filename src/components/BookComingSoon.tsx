import { useCompendiumText } from "./compendiumPresentation";
import { BookOpen } from "lucide-react";

export function BookComingSoon() {
  const t = useCompendiumText();
  return (
    <div className="book-coming-soon">
      <div>
        <BookOpen size={44} aria-hidden="true" />
        <p className="chapter">{t("Book mode", "Modo Libro")}</p>
        <h1>{t("Coming soon", "Próximamente")}</h1>
        <p>
          {t(
            "A paginated, chapter-by-chapter edition of your universe is on its way. Until then, the Web mode remains the full reading experience.",
            "La edición paginada de tu universo estará disponible próximamente. Puedes leer todo el contenido en el modo Web.",
          )}{" "}
        </p>
      </div>
    </div>
  );
}
