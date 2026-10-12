import { useCompendiumText } from "./compendiumPresentation";
import { useMemo, useState } from "react";
import { useDialogFocus } from "../useDialogFocus";
import { ExternalLink, MessageSquareText, X } from "lucide-react";
import { feedbackUrl } from "../feedback";

type FeedbackModalProps = {
  active?: boolean;
  screen: string;
  onClose: () => void;
  onOpenExternal: (url: string) => unknown;
};

export function FeedbackModal({
  active,
  screen,
  onClose,
  onOpenExternal,
}: FeedbackModalProps) {
  const t = useCompendiumText();
  const [frameError, setFrameError] = useState(false);
  const sourceUrl = useMemo(() => feedbackUrl(screen), [screen]);

  const dialogRef = useDialogFocus({ active, onClose });

  return (
    <div
      className="feedback-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="feedback-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="feedback-modal-header">
          <div className="feedback-modal-heading">
            <span className="feedback-modal-icon" aria-hidden="true">
              <MessageSquareText size={18} />
            </span>
            <div>
              <h2 id="feedback-modal-title">
                {t("Send feedback", "Enviar comentarios")}
              </h2>
              <p>
                {t("Help us improve this app.", "Ayúdanos a mejorar esta app.")}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="feedback-modal-close"
            onClick={onClose}
            aria-label={t("Close feedback", "Cerrar comentarios")}
          >
            <X size={18} />
          </button>
        </header>

        <div className="feedback-modal-frame-wrap">
          <iframe
            className="feedback-modal-frame"
            title={t("Feedback form", "Formulario de comentarios")}
            src={sourceUrl}
            onError={() => setFrameError(true)}
          />
          {frameError ? (
            <div className="feedback-modal-frame-error" role="alert">
              <strong>
                {t(
                  "The form could not be loaded.",
                  "No se pudo cargar el formulario.",
                )}
              </strong>
              <span>
                {t(
                  "Check your connection or open it in your browser.",
                  "Comprueba tu conexión o ábrelo en el navegador.",
                )}
              </span>
              <button
                type="button"
                className="feedback-modal-link"
                onClick={() => void onOpenExternal(sourceUrl)}
              >
                {t("Open in browser", "Abrir en navegador")}{" "}
                <ExternalLink size={14} />
              </button>
            </div>
          ) : null}
        </div>

        <footer className="feedback-modal-footer">
          <span>
            {t(
              "Your feedback is anonymous unless you leave an email.",
              "El envío es anónimo si no dejas un correo.",
            )}
          </span>
          <button
            type="button"
            className="feedback-modal-link"
            onClick={() => void onOpenExternal(sourceUrl)}
          >
            {t("Open in browser", "Abrir en navegador")}{" "}
            <ExternalLink size={14} />
          </button>
        </footer>
      </section>
    </div>
  );
}
