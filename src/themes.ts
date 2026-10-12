export type ThemeId =
  | "forge-mono-light"
  | "forge-mono-dark"
  | "worldnotion-light"
  | "worldnotion-dark"
  | "github"
  | "github-dark"
  | "one-light-pro"
  | "one-dark-pro"
  | "dracula-light"
  | "dracula"
  | "light-owl"
  | "night-owl"
  | "material-lighter"
  | "material-palenight";
export type ThemeMode = "light" | "dark";

export type ThemeDefinition = {
  id: ThemeId;
  label: string;
  isDark: boolean;
  mode: ThemeMode;
};

export const THEMES: ThemeDefinition[] = [
  {
    id: "forge-mono-light",
    label: "Everend Forge Light",
    isDark: false,
    mode: "light",
  },
  {
    id: "forge-mono-dark",
    label: "Everend Forge Dark",
    isDark: true,
    mode: "dark",
  },
  {
    id: "worldnotion-light",
    label: "WorldNotion Light",
    isDark: false,
    mode: "light",
  },
  {
    id: "worldnotion-dark",
    label: "WorldNotion Dark",
    isDark: true,
    mode: "dark",
  },
  { id: "github", label: "GitHub Light", isDark: false, mode: "light" },
  { id: "github-dark", label: "GitHub Dark", isDark: true, mode: "dark" },
  { id: "one-light-pro", label: "One Light Pro", isDark: false, mode: "light" },
  { id: "one-dark-pro", label: "One Dark Pro", isDark: true, mode: "dark" },
  { id: "dracula-light", label: "Dracula Light", isDark: false, mode: "light" },
  { id: "dracula", label: "Dracula", isDark: true, mode: "dark" },
  { id: "light-owl", label: "Light Owl", isDark: false, mode: "light" },
  { id: "night-owl", label: "Night Owl", isDark: true, mode: "dark" },
  {
    id: "material-lighter",
    label: "Material Lighter",
    isDark: false,
    mode: "light",
  },
  {
    id: "material-palenight",
    label: "Material Palenight",
    isDark: true,
    mode: "dark",
  },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);

const TOGGLED_THEME: Record<ThemeId, ThemeId> = {
  "forge-mono-light": "forge-mono-dark",
  "forge-mono-dark": "forge-mono-light",
  "worldnotion-light": "worldnotion-dark",
  "worldnotion-dark": "worldnotion-light",
  github: "github-dark",
  "github-dark": "github",
  "one-light-pro": "one-dark-pro",
  "one-dark-pro": "one-light-pro",
  "dracula-light": "dracula",
  dracula: "dracula-light",
  "light-owl": "night-owl",
  "night-owl": "light-owl",
  "material-lighter": "material-palenight",
  "material-palenight": "material-lighter",
};

export function normalizeThemeId(value: unknown): ThemeId {
  if (value === "light" || value === "compendium-light")
    return "worldnotion-light";
  if (value === "dark" || value === "compendium-dark")
    return "worldnotion-dark";
  return THEME_IDS.includes(value as ThemeId)
    ? (value as ThemeId)
    : "worldnotion-dark";
}

export function isDarkTheme(themeId: ThemeId) {
  return THEMES.find((theme) => theme.id === themeId)?.isDark ?? true;
}

export function toggledThemeMode(themeId: ThemeId): ThemeId {
  return TOGGLED_THEME[themeId] ?? "worldnotion-light";
}

/** Initial theme suggested by a compendium.yaml theme preset. */
export function themeForPreset(preset: string | undefined): ThemeId {
  if (preset === "parchment" || preset === "ink") return "worldnotion-light";
  return "worldnotion-dark";
}
