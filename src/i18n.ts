import {
  resolveLocale,
  setDocumentLocale,
  type Locale,
  type LocalePreference,
} from "./localePolicy";

export { normalizeLocalePreference } from "./localePolicy";
export type { Locale, LocalePreference };

export function resolveInterfaceLocale(preference: LocalePreference): Locale {
  return resolveLocale(preference);
}

export function applyInterfaceLocale(preference: LocalePreference): Locale {
  const locale = resolveInterfaceLocale(preference);
  setDocumentLocale(locale);
  return locale;
}

const copy = {
  en: { interfaceLanguage: "Interface language", system: "System default" },
  es: {
    interfaceLanguage: "Idioma de la interfaz",
    system: "Predeterminado del sistema",
  },
} as const;

export function interfaceLocaleCopy(locale: Locale) {
  return copy[locale];
}

const settingsCopy = {
  en: {
    title: "Settings",
    close: "Close",
    sections: "Settings sections",
    forge: "Forge",
    suite: "Suite",
    update: "Update",
    application: "Application",
    appearance: "Appearance",
    universe: "Universe",
    about: "About",
    suiteTitle: "Everend Forge Suite",
    suiteDescription: "Shared preferences applied to every app in this Suite.",
    style: "Style",
    typeface: "Primary typeface",
    sans: "Sans serif",
    serif: "Serif editorial",
    humanist: "Humanist",
    updateTitle: "Everend Forge Update",
    updateDescription:
      "Check, download, and install signed updates for the Suite.",
    installedVersion: "Installed version",
    platform: "Platform",
    applicationId: "Application ID",
    checking: "Checking for updates...",
    available: "Version {{version}} is ready",
    downloading: "Installing Everend Forge {{version}}...",
    upToDate: "You are up to date",
    updateFailed: "Update check failed",
    ready: "Ready to check for updates",
    updaterReady: "The updater is ready to contact the release server.",
    check: "Check for updates",
    install: "Download and install",
    appearanceTitle: "Reading appearance",
    appearanceDescription:
      "Choose a style and typeface that keep long-form reading comfortable.",
    universeTitle: "Current universe",
    universeDescription: "Identity and local folder controls.",
    aboutTitle: "About Compendium",
    aboutDescription:
      "A readable, public-facing projection of your Everend universe.",
    version: "Version",
    canonSafety: "Canon safety",
    canonValue: "Read-only; corrections are review proposals",
    documentation: "Open documentation",
  },
  es: {
    title: "Ajustes",
    close: "Cerrar",
    sections: "Secciones de ajustes",
    forge: "Forge",
    suite: "Suite",
    update: "Actualización",
    application: "Aplicación",
    appearance: "Apariencia",
    universe: "Universo",
    about: "Acerca de",
    suiteTitle: "Everend Forge Suite",
    suiteDescription:
      "Preferencias compartidas que se aplican a todas las apps de esta Suite.",
    style: "Estilo",
    typeface: "Tipografía principal",
    sans: "Sans serif",
    serif: "Serif editorial",
    humanist: "Humanista",
    updateTitle: "Actualización de Everend Forge",
    updateDescription:
      "Comprueba, descarga e instala actualizaciones firmadas de la Suite.",
    installedVersion: "Versión instalada",
    platform: "Plataforma",
    applicationId: "ID de aplicación",
    checking: "Comprobando actualizaciones...",
    available: "La versión {{version}} está lista",
    downloading: "Instalando Everend Forge {{version}}...",
    upToDate: "Estás al día",
    updateFailed: "La comprobación de actualización falló",
    ready: "Listo para comprobar actualizaciones",
    updaterReady:
      "El actualizador está listo para contactar el servidor de versiones.",
    check: "Comprobar actualizaciones",
    install: "Descargar e instalar",
    appearanceTitle: "Apariencia de lectura",
    appearanceDescription:
      "Elige un estilo y una tipografía cómodos para leer textos extensos.",
    universeTitle: "Universo actual",
    universeDescription: "Identidad y controles de carpeta local.",
    aboutTitle: "Acerca de Compendium",
    aboutDescription:
      "Una proyección legible y pública de tu universo Everend.",
    version: "Versión",
    canonSafety: "Seguridad de canon",
    canonValue: "Solo lectura; las correcciones son propuestas de revisión",
    documentation: "Abrir documentación",
  },
} as const;

export function compendiumSettingsCopy(locale: Locale) {
  return settingsCopy[locale];
}
