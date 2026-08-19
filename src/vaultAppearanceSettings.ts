import { normalizeThemeId, type ThemeId } from "./themes.js";
import { normalizePrimaryFont, type PrimaryFontId } from "./typography.js";
import type { CompendiumSettings } from "./settings.js";

/** Stored separately so appearance saves never overwrite the publication config. */
export const VAULT_APPEARANCE_SETTINGS_PATH =
  ".everend/.compendium/appearance.json";
const LEGACY_VAULT_APPEARANCE_SETTINGS_PATH =
  ".everend/.compendium/settings.json";

/**
 * The slice of {@link CompendiumSettings} that represents how this universe's
 * Compendium reader looks, rather than machine-local state (recent
 * universes). Persisted inside the universe itself so opening it anywhere
 * reproduces the same style.
 */
export type CompendiumVaultAppearanceSettings = {
  version: 1;
  theme: ThemeId;
  primaryFont: PrimaryFontId;
};

export function extractVaultAppearanceSettings(
  settings: CompendiumSettings,
): CompendiumVaultAppearanceSettings {
  return {
    version: 1,
    theme: settings.theme,
    primaryFont: settings.primaryFont,
  };
}

export function serializeVaultAppearance(
  appearance: CompendiumVaultAppearanceSettings,
): string {
  return `${JSON.stringify(appearance, null, 2)}\n`;
}

export function serializeVaultAppearanceSettings(
  settings: CompendiumSettings,
): string {
  return serializeVaultAppearance(extractVaultAppearanceSettings(settings));
}

/** Merges a universe's stored appearance over the current app settings; the universe wins. */
export function applyVaultAppearanceSettings(
  base: CompendiumSettings,
  appearance: CompendiumVaultAppearanceSettings | undefined,
): CompendiumSettings {
  if (!appearance) return base;
  return {
    ...base,
    theme: appearance.theme,
    primaryFont: appearance.primaryFont,
  };
}

export function parseVaultAppearanceSettings(
  files: Array<{ relativePath: string; content: string }>,
): CompendiumVaultAppearanceSettings | undefined {
  const file =
    files.find(
      (candidate) =>
        candidate.relativePath.replaceAll("\\", "/") ===
        VAULT_APPEARANCE_SETTINGS_PATH,
    ) ??
    files.find(
      (candidate) =>
        candidate.relativePath.replaceAll("\\", "/") ===
        LEGACY_VAULT_APPEARANCE_SETTINGS_PATH,
    );
  if (!file) return undefined;

  try {
    const parsed = JSON.parse(
      file.content,
    ) as Partial<CompendiumVaultAppearanceSettings> | null;
    if (!parsed || typeof parsed !== "object") return undefined;
    if ("specVersion" in parsed) return undefined;
    if (parsed.version !== 1 || typeof parsed.theme !== "string")
      return undefined;
    return {
      version: 1,
      theme: normalizeThemeId(parsed.theme),
      primaryFont: normalizePrimaryFont(parsed.primaryFont),
    };
  } catch {
    return undefined;
  }
}
