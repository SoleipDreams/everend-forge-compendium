import { normalizeBackgroundScene } from "./backgroundScenes";
import { normalizeThemeId, type ThemeId } from "./themes.js";
import { normalizePrimaryFont, type PrimaryFontId } from "./typography.js";
import { normalizeLocalePreference, type LocalePreference } from "./i18n";

export const SETTINGS_KEY = "compendium.settings.v1";

export type CompendiumExplorerSettings = {
  section: "cover" | "index" | "stories" | "views" | "publication";
  open: boolean;
  width: number;
  collapsed: string[];
};

export type CompendiumSettings = {
  /** Local reading navigation only; excluded from vault and publication. */
  explorer?: CompendiumExplorerSettings;
  /** Local UI preference, excluded from publication and vault profiles. */
  ambientBackground?: boolean;
  backgroundScene?: string;
  /** Interface language only; universe publication content is never modified. */
  localePreference: LocalePreference;
  theme: ThemeId;
  interfaceFont?: PrimaryFontId;
  primaryFont: PrimaryFontId;
  recentUniverse?: string;
  recentUniverses: string[];
};

const defaultSettings: CompendiumSettings = {
  explorer: { section: "index", open: true, width: 280, collapsed: [] },
  localePreference: "system",
  theme: "worldnotion-dark",
  ambientBackground: true,
  backgroundScene: "original",
  primaryFont: "sans",
  recentUniverses: [],
};

export function loadSettings(): CompendiumSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY);
    if (!stored) return { ...defaultSettings };
    const parsed = JSON.parse(stored) as Partial<CompendiumSettings>;
    const explorer = parsed.explorer;
    return {
      explorer: {
        section:
          explorer &&
          ["cover", "index", "stories", "views", "publication"].includes(
            explorer.section,
          )
            ? explorer.section
            : "index",
        open: explorer?.open !== false,
        width:
          typeof explorer?.width === "number" && Number.isFinite(explorer.width)
            ? Math.max(220, Math.min(420, explorer.width))
            : 280,
        collapsed: Array.isArray(explorer?.collapsed)
          ? explorer.collapsed.filter(
              (value): value is string => typeof value === "string",
            )
          : [],
      },
      localePreference: normalizeLocalePreference(parsed.localePreference),
      theme: normalizeThemeId(parsed.theme),
      ambientBackground: parsed.ambientBackground !== false,
      backgroundScene: normalizeBackgroundScene(parsed.backgroundScene),
      interfaceFont: normalizePrimaryFont(parsed.interfaceFont),
      primaryFont: normalizePrimaryFont(parsed.primaryFont),
      recentUniverse:
        typeof parsed.recentUniverse === "string"
          ? parsed.recentUniverse
          : undefined,
      recentUniverses: Array.isArray(parsed.recentUniverses)
        ? parsed.recentUniverses.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: CompendiumSettings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Persisting settings is best-effort.
  }
}

export function rememberUniverse(
  settings: CompendiumSettings,
  path: string,
): CompendiumSettings {
  return {
    ...settings,
    recentUniverse: path,
    recentUniverses: [
      path,
      ...settings.recentUniverses.filter((value) => value !== path),
    ].slice(0, 8),
  };
}
