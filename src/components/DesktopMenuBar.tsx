import { useEffect, useRef, useState } from "react";
import { ChevronRight, Home } from "lucide-react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Locale } from "../i18n";
import { isTauriRuntime } from "../tauriBridge";

type MenuItem = {
  label: string;
  id?: string;
  command?: string;
  separator?: boolean;
  disabled?: boolean;
};
type MenuGroup = { label: string; items: MenuItem[] };

function menuGroups(spanish: boolean, hasUniverse: boolean): MenuGroup[] {
  return [
    {
      label: spanish ? "Archivo" : "File",
      items: [
        {
          label: spanish ? "Abrir universo…" : "Open Universe…",
          id: "cp:file:open-universe",
          command: "Ctrl+O",
        },
        {
          label: spanish ? "Mostrar carpeta del universo" : "Reveal Universe",
          id: "cp:file:reveal-universe",
          disabled: !hasUniverse,
        },
        { label: "", separator: true },
        { label: spanish ? "Cerrar" : "Close", id: "cp:window:close" },
      ],
    },
    {
      label: spanish ? "Ver" : "View",
      items: [
        {
          label: spanish ? "Cambiar modo claro/oscuro" : "Toggle Light/Dark",
          id: "cp:view:toggle-light-dark",
          command: "Ctrl+Shift+L",
        },
        {
          label: spanish ? "Modo web" : "Web Mode",
          id: "cp:view:mode-web",
          command: "Ctrl+1",
        },
        {
          label: spanish ? "Modo libro" : "Book Mode",
          id: "cp:view:mode-book",
          command: "Ctrl+2",
        },
        { label: "", separator: true },
        {
          label: spanish ? "Recargar vista" : "Reload",
          id: "cp:view:reload",
          command: "Ctrl+R",
        },
        { label: spanish ? "Ajustes…" : "Settings…", id: "cp:app:settings" },
      ],
    },
    {
      label: spanish ? "Ventana" : "Window",
      items: [
        { label: spanish ? "Minimizar" : "Minimize", id: "cp:window:minimize" },
        {
          label: spanish ? "Maximizar o restaurar" : "Maximize or Restore",
          id: "cp:window:toggle-maximize",
        },
        { label: spanish ? "Cerrar" : "Close", id: "cp:window:close" },
      ],
    },
    {
      label: spanish ? "Ayuda" : "Help",
      items: [
        {
          label: spanish ? "Acerca de Compendium" : "About Everend Compendium",
          id: "cp:help:about",
        },
        {
          label: spanish ? "Documentación" : "Documentation",
          id: "cp:help:docs",
        },
        {
          label: spanish ? "Enviar feedback" : "Send feedback",
          id: "cp:help:feedback",
        },
      ],
    },
  ];
}

export function DesktopMenuBar({
  locale,
  onHome,
  hasUniverse = false,
}: {
  locale: Locale;
  onHome: () => void;
  hasUniverse?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string>();
  const menuRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const homeRef = useRef<HTMLButtonElement>(null);
  const spanish = locale === "es";
  const desktopMenuAvailable =
    isTauriRuntime() && !/Mac|iPhone|iPad/.test(navigator.platform);

  useEffect(() => {
    if (!open) return;
    homeRef.current?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setOpenGroup(undefined);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      setOpenGroup(undefined);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setOpenGroup(undefined);
  };
  const invoke = (item: MenuItem) => {
    closeMenu();
    const currentWindow = getCurrentWindow();
    if (item.id === "cp:window:close") void currentWindow.close();
    else if (item.id === "cp:window:minimize") void currentWindow.minimize();
    else if (item.id === "cp:window:toggle-maximize")
      void currentWindow.toggleMaximize();
    else if (item.id) void emit("compendium-menu", item.id);
  };
  const label = spanish
    ? "Inicio y menú de la aplicación"
    : "Home and application menu";

  return (
    <nav
      className="cp-desktop-menu"
      aria-label={spanish ? "Menú de la aplicación" : "Application menu"}
      ref={menuRef}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`reader-icon-button cp-home-menu-trigger ${open ? "active" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup={desktopMenuAvailable ? "menu" : undefined}
        aria-expanded={desktopMenuAvailable ? open : undefined}
        onClick={() => {
          if (!desktopMenuAvailable) {
            onHome();
            return;
          }
          setOpen((current) => !current);
          setOpenGroup(undefined);
        }}
      >
        <Home size={15} aria-hidden="true" />
      </button>
      {desktopMenuAvailable && open ? (
        <div
          className="cp-home-menu-popover"
          role="menu"
          aria-label={spanish ? "Menú de la aplicación" : "Application menu"}
        >
          <button
            ref={homeRef}
            className="cp-home-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              closeMenu();
              onHome();
            }}
          >
            <Home size={14} aria-hidden="true" />
            <span>{spanish ? "Volver al Home" : "Back to Home"}</span>
          </button>
          <div className="cp-desktop-menu-separator" role="separator" />
          {menuGroups(spanish, hasUniverse).map((group) => (
            <div className="cp-desktop-menu-group" key={group.label}>
              <button
                type="button"
                role="menuitem"
                className={openGroup === group.label ? "active" : ""}
                aria-haspopup="menu"
                aria-expanded={openGroup === group.label}
                onClick={() =>
                  setOpenGroup((current) =>
                    current === group.label ? undefined : group.label,
                  )
                }
              >
                <span>{group.label}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
              {openGroup === group.label ? (
                <div
                  className="cp-desktop-menu-submenu"
                  role="menu"
                  aria-label={group.label}
                >
                  {group.items.map((item, index) =>
                    item.separator ? (
                      <div
                        className="cp-desktop-menu-separator"
                        role="separator"
                        key={index}
                      />
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        key={item.id}
                        disabled={item.disabled}
                        onClick={() => invoke(item)}
                      >
                        <span>{item.label}</span>
                        <kbd>{item.command}</kbd>
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
