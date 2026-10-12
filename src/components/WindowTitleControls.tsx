import { useEffect, useRef, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Locale } from "../i18n";
import { isTauriRuntime } from "../tauriBridge";

export function WindowChromeSetup() {
  useEffect(() => {
    if (!isTauriRuntime()) return;
    void getCurrentWindow()
      .setDecorations(false)
      .catch((error) => {
        console.error("Could not disable native window decorations:", error);
      });
  }, []);
  return null;
}

/** Apply the existing editor/write guard to every standalone close request. */
export function useStandaloneWindowClose(
  enabled: boolean,
  beforeClose: () => Promise<boolean>,
) {
  const beforeCloseRef = useRef(beforeClose);
  beforeCloseRef.current = beforeClose;
  useEffect(() => {
    if (!enabled || !isTauriRuntime()) return;
    const currentWindow = getCurrentWindow();
    let disposed = false;
    let closing = false;
    let allowed = false;
    let unlisten: (() => void) | undefined;
    void currentWindow
      .onCloseRequested((event) => {
        if (allowed) return;
        event.preventDefault();
        if (closing) return;
        closing = true;
        void beforeCloseRef
          .current()
          .then(async (ready) => {
            if (!ready || disposed) return;
            allowed = true;
            await currentWindow.close();
          })
          .catch((error) => {
            allowed = false;
            console.error("Could not close Compendium:", error);
          })
          .finally(() => {
            closing = false;
          });
      })
      .then((stop) => {
        unlisten = stop;
        if (disposed) stop();
      })
      .catch((error) =>
        console.error("Could not register window close guard:", error),
      );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [enabled]);
}

export function WindowTitleControls({ locale }: { locale: Locale }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const currentWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const refresh = () => {
      void currentWindow
        .isMaximized()
        .then((value) => {
          if (!disposed) setMaximized(value);
        })
        .catch(() => undefined);
    };
    refresh();
    void currentWindow
      .onResized(refresh)
      .then((stop) => {
        unlisten = stop;
        if (disposed) stop();
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!isTauriRuntime()) return null;
  const labels =
    locale === "es"
      ? {
          minimize: "Minimizar",
          maximize: "Maximizar",
          restore: "Restaurar",
          close: "Cerrar",
          group: "Controles de ventana",
        }
      : {
          minimize: "Minimize",
          maximize: "Maximize",
          restore: "Restore",
          close: "Close",
          group: "Window controls",
        };
  return (
    <div
      className="cp-window-title-controls"
      role="group"
      aria-label={labels.group}
      data-tauri-drag-region="false"
    >
      <button
        type="button"
        aria-label={labels.minimize}
        title={labels.minimize}
        onClick={() => {
          void getCurrentWindow().minimize();
        }}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={maximized ? labels.restore : labels.maximize}
        title={maximized ? labels.restore : labels.maximize}
        onClick={() => {
          void getCurrentWindow()
            .toggleMaximize()
            .then(() => getCurrentWindow().isMaximized())
            .then(setMaximized);
        }}
      >
        {maximized ? (
          <Copy size={12} aria-hidden="true" />
        ) : (
          <Square size={12} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        className="cp-window-close"
        aria-label={labels.close}
        title={labels.close}
        onClick={() => {
          void getCurrentWindow().close();
        }}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
