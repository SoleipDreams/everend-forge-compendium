import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  BookOpen,
  Castle,
  ExternalLink,
  FileWarning,
  FolderOpen,
  Globe2,
  Home,
  MessageSquareText,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Upload,
  Wrench,
} from "lucide-react";
import compendiumIcon from "./assets/everend-compendium-icon.png";
import forgeLogoOnDark from "./assets/everend-forge-logo-on-dark.png";
import forgeLogoOnLight from "./assets/everend-forge-logo-on-light.png";
import { Reader, type ReaderMode } from "./components/Reader";
import { PublicationManager } from "./components/PublicationManager";
import { mapDefinitions } from "./components/MapsView";
import { SearchBox } from "./components/SearchBox";
import { timelineEntries } from "./components/TimelineView";
import { UniverseIconFrame } from "./components/UniverseIconFrame";
import { CorrectionDialog } from "./components/CorrectionDialog";
import { BrandLoadingScreen } from "./components/BrandLoadingScreen";
import { FeedbackModal } from "./components/FeedbackModal";
import {
  SettingsDialog,
  type SettingsSection,
} from "./components/SettingsDialog";
import { assembleIndexedUniverse } from "./lib/assemble";
import {
  loadPublicationProfiles,
  profileForId,
  projectIndexedUniverse,
  publicationRelativePath,
  serializePublicationProfile,
} from "./lib/publications";
import { serializeConfig } from "./lib/config";
import { sanitizeDom } from "./lib/sanitize-dom";
import {
  loadSettings,
  rememberUniverse,
  saveSettings,
  type CompendiumSettings,
} from "./settings";
import { applyInterfaceLocale } from "./i18n";
import {
  indexVault,
  isTauriRuntime,
  openExternal,
  openVaultDialog,
  revealVault,
  deleteUniverseFile,
  saveUniverseTextFile,
} from "./tauriBridge";
import {
  isDarkTheme,
  THEMES,
  themeForPreset,
  toggledThemeMode,
  type ThemeId,
} from "./themes";
import {
  PRIMARY_FONT_OPTIONS,
  primaryFontCssValue,
  type PrimaryFontId,
} from "./typography";
import type {
  Entity,
  IndexedUniverse,
  PublicationMode,
  PublicationProfile,
  SiteData,
  UniverseProfile,
} from "./types";
import type { SuiteChrome } from "./suiteChrome";
import {
  VAULT_APPEARANCE_SETTINGS_PATH,
  applyVaultAppearanceSettings,
  parseVaultAppearanceSettings,
  serializeVaultAppearance,
  serializeVaultAppearanceSettings,
} from "./vaultAppearanceSettings";

const EVEREND_FORGE_GITHUB_URL =
  "https://github.com/SoleipDreams/everend-forge";
const BUY_SUITE_URL = "https://everendforge.com/buy-suite";
const COMPENDIUM_DOCS_URL =
  "https://github.com/SoleipDreams/everend-compendium";

function ForgeCornerLogo() {
  return (
    <>
      <img
        className="forge-logo forge-logo-on-light"
        src={forgeLogoOnLight}
        alt=""
        aria-hidden="true"
      />
      <img
        className="forge-logo forge-logo-on-dark"
        src={forgeLogoOnDark}
        alt=""
        aria-hidden="true"
      />
    </>
  );
}

type AppView = "home" | "reader";
type LoadState = "idle" | "loading" | "error";
type SettingsScope = "app" | "universe" | "about" | "suite" | "update";

function universePathName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function universeDisplayName(site: SiteData) {
  return site.universeProfile?.name ?? site.title;
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function UniverseProfileEditor({
  site,
  onSave,
}: {
  site: SiteData;
  onSave: (profile: UniverseProfile) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UniverseProfile>(() => ({
    name: site.universeProfile?.name ?? site.title,
    icon: site.universeProfile?.icon ?? { type: "preset", value: "book" },
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      name: site.universeProfile?.name ?? site.title,
      icon: site.universeProfile?.icon ?? { type: "preset", value: "book" },
    });
  }, [site]);

  return (
    <div className="universe-profile-editor">
      <UniverseIconFrame profile={draft} size={48} />
      <div className="universe-profile-fields">
        <label>
          <span>Universe name</span>
          <input
            value={draft.name ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder={site.title}
          />
        </label>
        <div className="icon-preset-row">
          {[
            ["book", BookOpen],
            ["globe", Globe2],
            ["castle", Castle],
            ["sparkles", Sparkles],
          ].map(([value, Icon]) => (
            <button
              key={value as string}
              type="button"
              className={
                draft.icon?.type === "preset" && draft.icon.value === value
                  ? "active"
                  : ""
              }
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  icon: { type: "preset", value: value as string },
                }))
              }
              title={`Use ${value} icon`}
            >
              <Icon size={16} />
            </button>
          ))}
          <label className="image-upload-button" title="Use PNG or JPG">
            <Upload size={16} />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const value = await readImageFile(file);
                setDraft((current) => ({
                  ...current,
                  icon: { type: "image", value },
                }));
              }}
            />
          </label>
        </div>
        <button
          type="button"
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(draft);
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
        >
          Save customization
        </button>
      </div>
    </div>
  );
}

function TypographySettings({
  value,
  onChange,
}: {
  value: PrimaryFontId;
  onChange: (font: PrimaryFontId) => void;
}) {
  return (
    <label className="typography-setting">
      <span>Primary typeface</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as PrimaryFontId)}
      >
        {PRIMARY_FONT_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const STARTUP_LOADER_MIN_MS = 700;

function App({ suiteChrome }: { suiteChrome?: SuiteChrome } = {}) {
  const [settings, setSettings] = useState<CompendiumSettings>(() =>
    loadSettings(),
  );
  useEffect(() => {
    applyInterfaceLocale(
      suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference,
    );
  }, [settings.localePreference, suiteChrome?.suiteSettings?.localePreference]);
  const [view, setView] = useState<AppView>("home");
  const [site, setSite] = useState<SiteData>();
  const [indexedUniverse, setIndexedUniverse] = useState<IndexedUniverse>();
  const [publicationProfiles, setPublicationProfiles] = useState<
    PublicationProfile[]
  >([]);
  const [activePublicationId, setActivePublicationId] = useState("default");
  const [publicationMode, setPublicationMode] =
    useState<PublicationMode>("preview");
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [initialReady, setInitialReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState<ReaderMode>("web");
  const [route, setRoute] = useState("/");
  const [forgeMenuOpen, setForgeMenuOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("app");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [correctionEntity, setCorrectionEntity] = useState<Entity>();
  const forgeMenuRef = useRef<HTMLDivElement | null>(null);
  const appliedPresetRef = useRef<string | undefined>(undefined);
  const recentUniverseAttemptedRef = useRef<string | undefined>(undefined);
  const startupStartedAtRef = useRef(Date.now());
  const startupReadyTimerRef = useRef<number | undefined>(undefined);
  /** Serialized appearance last known to match `.everend/.compendium/appearance.json` on disk. */
  const vaultAppearanceOnDiskRef = useRef<string | undefined>(undefined);

  const finishInitialStartup = useCallback(() => {
    if (startupReadyTimerRef.current !== undefined) return;
    const remaining = Math.max(
      0,
      STARTUP_LOADER_MIN_MS - (Date.now() - startupStartedAtRef.current),
    );
    startupReadyTimerRef.current = window.setTimeout(() => {
      startupReadyTimerRef.current = undefined;
      setInitialReady(true);
    }, remaining);
  }, []);

  useEffect(
    () => () => {
      if (startupReadyTimerRef.current !== undefined) {
        window.clearTimeout(startupReadyTimerRef.current);
        startupReadyTimerRef.current = undefined;
      }
    },
    [],
  );

  useEffect(() => {
    document.documentElement.dataset.theme =
      suiteChrome?.suiteSettings?.style ?? settings.theme;
    document.documentElement.style.setProperty(
      "--ef-primary-font",
      primaryFontCssValue(settings.primaryFont),
    );
    document.documentElement.style.removeProperty("--cp-accent");
    saveSettings(settings);
  }, [settings, suiteChrome?.suiteSettings?.style]);

  useEffect(() => {
    const vaultPath = site?.vaultPath;
    if (!vaultPath || !isTauriRuntime()) return;
    const content = serializeVaultAppearanceSettings(settings);
    if (vaultAppearanceOnDiskRef.current === content) return;
    const timer = setTimeout(() => {
      vaultAppearanceOnDiskRef.current = content;
      void saveUniverseTextFile(
        vaultPath,
        VAULT_APPEARANCE_SETTINGS_PATH,
        content,
      )
        .then((result) => {
          if (!result.ok && vaultAppearanceOnDiskRef.current === content) {
            vaultAppearanceOnDiskRef.current = undefined;
          }
        })
        .catch(() => {
          if (vaultAppearanceOnDiskRef.current === content) {
            vaultAppearanceOnDiskRef.current = undefined;
          }
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, site?.vaultPath]);

  useEffect(() => {
    if (!forgeMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (forgeMenuRef.current?.contains(event.target as Node)) return;
      setForgeMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [forgeMenuOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setShowSettings(false);
      setShowDiagnostics(false);
      setCorrectionEntity(undefined);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const navigate = useCallback((nextRoute: string) => {
    setRoute(nextRoute);
  }, []);

  const applySite = useCallback((data: SiteData, resetRoute = true) => {
    setSite(data);
    if (resetRoute) setRoute("/");
    setView("reader");
    setLoadState("idle");
    setErrorMessage("");
    const preset = data.config.theme?.preset;
    if (preset && appliedPresetRef.current !== preset) {
      appliedPresetRef.current = preset;
      setSettings((current) => ({ ...current, theme: themeForPreset(preset) }));
    }
  }, []);

  const loadUniverse = useCallback(
    async (path: string) => {
      setLoadState("loading");
      setErrorMessage("");
      try {
        const result = await indexVault(path);
        const indexed = assembleIndexedUniverse(
          result.rootPath,
          result.files,
          sanitizeDom,
        );
        const loadedProfiles = loadPublicationProfiles(
          result.files,
          indexed.config,
        );
        const activeProfile = loadedProfiles.active;
        const data = projectIndexedUniverse(
          indexed,
          "preview",
          activeProfile,
          sanitizeDom,
        );
        if (loadedProfiles.warnings.length) {
          data.warnings = [...data.warnings, ...loadedProfiles.warnings];
        }
        setIndexedUniverse(indexed);
        setPublicationProfiles(loadedProfiles.profiles);
        setActivePublicationId(activeProfile.id);
        setPublicationMode("preview");
        const vaultAppearance = parseVaultAppearanceSettings(result.files);
        // Track what's on disk for this universe so the appearance-save
        // effect doesn't immediately re-write the file it just loaded, but
        // does seed `.everend/.compendium/appearance.json` the first time a
        // universe without one opens.
        vaultAppearanceOnDiskRef.current = vaultAppearance
          ? serializeVaultAppearance(vaultAppearance)
          : undefined;
        applySite(data, true);
        setSettings((current) =>
          applyVaultAppearanceSettings(
            rememberUniverse(current, result.rootPath),
            vaultAppearance,
          ),
        );
        finishInitialStartup();
        suiteChrome?.onReady?.();
      } catch (error) {
        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : String(error));
        finishInitialStartup();
        suiteChrome?.onReady?.();
      }
    },
    [applySite, finishInitialStartup, suiteChrome?.onReady],
  );

  useEffect(() => {
    const path = suiteChrome?.sharedUniversePath;
    if (!path || site?.vaultPath === path) return;
    void loadUniverse(path);
  }, [loadUniverse, site?.vaultPath, suiteChrome?.sharedUniversePath]);

  useEffect(() => {
    if (
      !isTauriRuntime() ||
      suiteChrome?.sharedUniversePath ||
      site ||
      loadState !== "idle"
    ) {
      return;
    }
    const path = settings.recentUniverse;
    if (!path || recentUniverseAttemptedRef.current === path) return;
    recentUniverseAttemptedRef.current = path;
    void loadUniverse(path);
  }, [
    loadState,
    loadUniverse,
    settings.recentUniverse,
    site?.vaultPath,
    suiteChrome?.sharedUniversePath,
  ]);

  useEffect(() => {
    const path = suiteChrome?.sharedUniversePath;
    if (!path || site?.vaultPath === path) return;
    void loadUniverse(path);
  }, [loadUniverse, site?.vaultPath, suiteChrome?.sharedUniversePath]);

  useEffect(() => {
    if (suiteChrome?.sharedUniversePath) return;
    if (
      !isTauriRuntime() ||
      !settings.recentUniverse ||
      settings.recentUniverse.startsWith("browser:")
    ) {
      finishInitialStartup();
    }
  }, [
    finishInitialStartup,
    settings.recentUniverse,
    suiteChrome?.sharedUniversePath,
  ]);

  const openUniverse = useCallback(async () => {
    if (!isTauriRuntime()) {
      setLoadState("error");
      setErrorMessage(
        "Open Everend Compendium as a desktop app to choose a universe folder.",
      );
      return;
    }
    const path = await openVaultDialog();
    if (path) await loadUniverse(path);
  }, [loadUniverse]);

  const openRecentUniverse = useCallback(
    async (path?: string) => {
      const target = path ?? settings.recentUniverse;
      if (target) await loadUniverse(target);
    },
    [loadUniverse, settings.recentUniverse],
  );

  const toggleTheme = useCallback(() => {
    if (suiteChrome?.suiteSettings) {
      suiteChrome.suiteSettings.onToggleStyleMode();
      return;
    }
    setSettings((current) => ({
      ...current,
      theme: toggledThemeMode(current.theme),
    }));
  }, [suiteChrome?.suiteSettings]);

  const activeTheme = (suiteChrome?.suiteSettings?.style ??
    settings.theme) as ThemeId;
  const activeThemeIsDark = isDarkTheme(activeTheme);

  const effectivePrimaryFont = (suiteChrome?.suiteSettings?.primaryFont ??
    settings.primaryFont) as PrimaryFontId;
  const setPrimaryFont = useCallback(
    (primaryFont: PrimaryFontId) => {
      if (suiteChrome?.suiteSettings) {
        suiteChrome.suiteSettings.onPrimaryFontChange(primaryFont);
        return;
      }
      setSettings((current) => ({ ...current, primaryFont }));
    },
    [suiteChrome?.suiteSettings],
  );

  const setStandaloneStyle = useCallback((theme: ThemeId) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const openSettings = useCallback((scope: SettingsScope) => {
    setSettingsScope(scope);
    setShowSettings(true);
  }, []);

  const settingsSection: SettingsSection =
    settingsScope === "app" ? "appearance" : settingsScope;

  const changeSettingsSection = useCallback((section: SettingsSection) => {
    setSettingsScope(section === "appearance" ? "app" : section);
  }, []);

  const saveUniverseProfile = useCallback(
    async (profile: UniverseProfile) => {
      if (!site) return;
      const normalizedProfile: UniverseProfile = {
        name: profile.name?.trim() || undefined,
        icon: profile.icon,
      };
      const result = await saveUniverseTextFile(
        site.vaultPath,
        ".everend/universe.json",
        `${JSON.stringify(normalizedProfile, null, 2)}\n`,
      );
      if (!result.ok)
        throw new Error(result.message ?? "Could not save universe profile.");
      setSite((current) =>
        current ? { ...current, universeProfile: normalizedProfile } : current,
      );
    },
    [site],
  );

  const savePublicationProfile = useCallback(
    async (profile: PublicationProfile) => {
      if (!site) return;
      const result = await saveUniverseTextFile(
        site.vaultPath,
        publicationRelativePath(profile.id),
        serializePublicationProfile(profile),
      );
      if (!result.ok) {
        throw new Error(
          result.message ?? "Could not save publication profile.",
        );
      }
      setPublicationProfiles((current) => {
        const next = current.filter((item) => item.id !== profile.id);
        return [...next, profile].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });
    },
    [site],
  );

  const activatePublicationProfile = useCallback(
    async (profile: PublicationProfile) => {
      if (!site || !indexedUniverse) return;
      const nextConfig = {
        ...indexedUniverse.config,
        publication: {
          ...indexedUniverse.config.publication,
          activeProfileId: profile.id,
        },
      };
      const result = await saveUniverseTextFile(
        site.vaultPath,
        ".everend/.compendium/settings.json",
        serializeConfig(nextConfig),
      );
      if (!result.ok) {
        throw new Error(
          result.message ?? "Could not activate publication profile.",
        );
      }
      const nextIndexed = { ...indexedUniverse, config: nextConfig };
      setIndexedUniverse(nextIndexed);
      setActivePublicationId(profile.id);
      setPublicationMode("preview");
      applySite(
        projectIndexedUniverse(nextIndexed, "preview", profile, sanitizeDom),
        false,
      );
    },
    [applySite, indexedUniverse, site],
  );

  const deletePublicationProfile = useCallback(
    async (profile: PublicationProfile) => {
      if (!site || publicationProfiles.length <= 1) {
        throw new Error("Keep at least one publication profile.");
      }
      const result = await deleteUniverseFile(
        site.vaultPath,
        publicationRelativePath(profile.id),
      );
      if (!result.ok) {
        throw new Error(
          result.message ?? "Could not delete publication profile.",
        );
      }
      const remaining = publicationProfiles.filter(
        (item) => item.id !== profile.id,
      );
      setPublicationProfiles(remaining);
      if (activePublicationId === profile.id) {
        await activatePublicationProfile(remaining[0]);
      }
    },
    [
      activatePublicationProfile,
      activePublicationId,
      publicationProfiles,
      site,
    ],
  );

  const previewPublicationProfile = useCallback(
    (profile: PublicationProfile) => {
      if (!indexedUniverse) return;
      setPublicationMode("preview");
      applySite(
        projectIndexedUniverse(
          indexedUniverse,
          "preview",
          profile,
          sanitizeDom,
        ),
        false,
      );
      setShowSettings(false);
    },
    [applySite, indexedUniverse],
  );

  const switchPublicationMode = useCallback(
    (nextMode: PublicationMode) => {
      if (!indexedUniverse) return;
      const profile = profileForId(
        publicationProfiles,
        activePublicationId,
        indexedUniverse.config,
      );
      setPublicationMode(nextMode);
      applySite(
        projectIndexedUniverse(indexedUniverse, nextMode, profile, sanitizeDom),
        false,
      );
    },
    [activePublicationId, applySite, indexedUniverse, publicationProfiles],
  );

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<string>("compendium-menu", (event) => {
      if (event.payload === "cp:file:open-universe") void openUniverse();
      if (event.payload === "cp:file:reveal-universe" && site) {
        void revealVault(site.vaultPath);
      }
      if (event.payload === "cp:view:toggle-light-dark") toggleTheme();
      if (event.payload === "cp:view:mode-web") setMode("web");
      if (event.payload === "cp:view:mode-book") setMode("book");
      if (event.payload === "cp:view:reload") window.location.reload();
      if (event.payload === "cp:help:about") {
        setErrorMessage(
          "Everend Compendium 0.2.0 - a readable edition of your universe.",
        );
        setLoadState("error");
      }
      if (event.payload === "cp:help:docs")
        void openExternal(COMPENDIUM_DOCS_URL);
    }).then((nextUnlisten) => {
      if (disposed) {
        nextUnlisten();
      } else {
        unlisten = nextUnlisten;
      }
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openUniverse, site, toggleTheme]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setForgeMenuOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function readCurrentUniverse() {
    if (site) await loadUniverse(site.vaultPath);
  }

  if (!suiteChrome && !initialReady) {
    return (
      <BrandLoadingScreen
        message={
          loadState === "loading"
            ? "Opening your universe…"
            : "Preparing your reading space…"
        }
      />
    );
  }

  if (view === "home" || !site) {
    if (suiteChrome?.sharedUniversePath) {
      return (
        <main
          className="suite-shared-world-loading"
          aria-busy={loadState === "loading"}
        >
          <p>
            {loadState === "error"
              ? errorMessage
              : "Opening the shared world..."}
          </p>
          {loadState === "error" ? (
            <button type="button" onClick={suiteChrome.onHome}>
              Choose another world
            </button>
          ) : null}
        </main>
      );
    }

    return (
      <main className="home-shell">
        <header className="home-topbar">
          <div className="brand">
            <img
              className="app-brand-icon"
              src={compendiumIcon}
              alt=""
              aria-hidden="true"
            />
            <div>
              <h1>Compendium</h1>
              <p>A readable edition of your universe</p>
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => openSettings("app")}
              aria-expanded={showSettings}
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowFeedback(true)}
              title="Enviar feedback"
              aria-label="Enviar feedback"
            >
              <MessageSquareText size={16} />
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {activeThemeIsDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        {showSettings ? (
          <SettingsDialog
            section={settingsSection}
            onSectionChange={changeSettingsSection}
            onClose={() => setShowSettings(false)}
            localePreference={
              suiteChrome?.suiteSettings?.localePreference ??
              settings.localePreference
            }
            onLocalePreferenceChange={(localePreference) =>
              suiteChrome?.suiteSettings
                ? suiteChrome.suiteSettings.onLocalePreferenceChange(
                    localePreference,
                  )
                : setSettings((current) => ({ ...current, localePreference }))
            }
            onOpenDocs={() => void openExternal(COMPENDIUM_DOCS_URL)}
            appearance={
              <>
                <label className="typography-setting">
                  <span>Style</span>
                  <select
                    value={suiteChrome?.suiteSettings?.style ?? settings.theme}
                    onChange={(event) =>
                      suiteChrome?.suiteSettings
                        ? suiteChrome.suiteSettings.onStyleChange(
                            event.target.value,
                          )
                        : setStandaloneStyle(event.target.value as ThemeId)
                    }
                  >
                    {THEMES.map((theme) => (
                      <option key={theme.id} value={theme.id}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
                <TypographySettings
                  value={effectivePrimaryFont}
                  onChange={setPrimaryFont}
                />
              </>
            }
            suiteSettings={suiteChrome?.suiteSettings}
          />
        ) : null}
        <section className="home-panel">
          <div className="home-hero">
            <div className="home-copy">
              <p className="eyebrow">Home</p>
              <h2>Choose a universe</h2>
              <p>
                Open a WorldNotion vault to read its published canon and stories
                as a living book.
              </p>
            </div>
            {site ? (
              <button
                type="button"
                className="active-universe-card"
                onClick={() => setView("reader")}
              >
                <BookOpen size={22} aria-hidden="true" />
                <span className="active-universe-copy">
                  <span className="eyebrow">Continue reading</span>
                  <strong>{universeDisplayName(site)}</strong>
                  <span>
                    {site.entities.length} entries · {site.stories.length}{" "}
                    stories
                  </span>
                </span>
              </button>
            ) : null}
          </div>
          <div className="home-actions">
            <button
              type="button"
              className="primary-action"
              onClick={openUniverse}
            >
              <FolderOpen size={16} />
              Open Universe
            </button>
            {settings.recentUniverse ? (
              <button type="button" onClick={() => void openRecentUniverse()}>
                <BookOpen size={16} />
                Open Recent
              </button>
            ) : null}
          </div>
          {loadState === "loading" ? (
            <p className="home-status">Opening universe...</p>
          ) : null}
          {loadState === "error" && errorMessage ? (
            <div className="error-banner">{errorMessage}</div>
          ) : null}
          {settings.recentUniverses.length > 0 ? (
            <div className="recent-section">
              <p className="eyebrow">Recent universes</p>
              <ul className="recent-list">
                {settings.recentUniverses.map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      onClick={() => void openRecentUniverse(path)}
                    >
                      <strong>{universePathName(path)}</strong>
                      <span>{path}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  const hasTimeline = timelineEntries(site).length > 0;
  const hasMaps = mapDefinitions(site).length > 0;
  const activePublication = indexedUniverse
    ? profileForId(
        publicationProfiles,
        activePublicationId,
        indexedUniverse.config,
      )
    : undefined;

  return (
    <main className="app-shell compendium-shell">
      <div className="reader-top-bar" aria-label="Reader controls">
        {suiteChrome ? (
          suiteChrome.renderAppSwitcher()
        ) : (
          <div
            ref={forgeMenuRef}
            className={`forge-corner-menu ${forgeMenuOpen ? "open" : ""}`}
          >
            <div className="forge-orbit-panel" aria-label="Everend menu">
              <button
                type="button"
                onClick={() => {
                  setView("home");
                  setForgeMenuOpen(false);
                }}
              >
                Compendium Home
              </button>
              <button
                type="button"
                onClick={() => {
                  void openUniverse();
                  setForgeMenuOpen(false);
                }}
              >
                Open Universe…
              </button>
              <button
                type="button"
                onClick={() => {
                  openSettings("app");
                  setForgeMenuOpen(false);
                }}
              >
                Settings…
              </button>
              <span className="forge-menu-separator" />
              <button
                type="button"
                onClick={() =>
                  void openExternal(EVEREND_FORGE_GITHUB_URL).then(() =>
                    setForgeMenuOpen(false),
                  )
                }
              >
                GitHub
              </button>
              <button
                type="button"
                onClick={() =>
                  void openExternal(BUY_SUITE_URL).then(() =>
                    setForgeMenuOpen(false),
                  )
                }
              >
                Buy Suite
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgeMenuOpen(false);
                  setShowFeedback(true);
                }}
              >
                Enviar feedback
              </button>
              <button
                type="button"
                onClick={() => {
                  openSettings("about");
                  setForgeMenuOpen(false);
                }}
              >
                About Compendium
              </button>
            </div>
            <button
              type="button"
              className="forge-corner-button"
              onClick={() => setForgeMenuOpen((open) => !open)}
              aria-expanded={forgeMenuOpen}
              aria-label="Open Everend menu"
              title="Everend menu"
            >
              <ForgeCornerLogo />
            </button>
          </div>
        )}

        <div className="reader-top-left">
          <button
            type="button"
            className="reader-icon-button"
            onClick={suiteChrome?.onHome ?? (() => setView("home"))}
            title="Home"
          >
            <Home size={15} />
          </button>
          <span className="reader-top-divider" aria-hidden="true" />
          <button
            type="button"
            className="reader-universe-button"
            onClick={() => openSettings("universe")}
            title={site.vaultPath}
          >
            <UniverseIconFrame profile={site.universeProfile} />
            <span className="reader-universe-copy">
              <strong>{universeDisplayName(site)}</strong>
              <span>{universePathName(site.vaultPath)}</span>
            </span>
          </button>
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => openSettings("app")}
            title="Application settings"
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => void revealVault(site.vaultPath)}
            title="Show universe in Finder"
          >
            <ExternalLink size={15} />
          </button>
        </div>

        <nav className="reader-nav" aria-label="Primary navigation">
          <button
            type="button"
            className={route.startsWith("/stories/") ? "active" : ""}
            onClick={() => navigate("/stories/")}
          >
            Stories
          </button>
          <button
            type="button"
            className={route === "/" ? "active" : ""}
            onClick={() => navigate("/")}
          >
            Universe
          </button>
          <div className="graphs-menu">
            <button
              type="button"
              className={route === "/graph/" ? "active" : ""}
              onClick={() => navigate("/graph/")}
            >
              Graphs
            </button>
            <div className="graphs-submenu" aria-label="Graphs">
              <button
                type="button"
                className={route === "/graph/" ? "active" : ""}
                onClick={() => navigate("/graph/")}
              >
                Graph
              </button>
              {hasTimeline ? (
                <button
                  type="button"
                  className={route === "/timeline/" ? "active" : ""}
                  onClick={() => navigate("/timeline/")}
                >
                  Timeline
                </button>
              ) : null}
              {hasMaps ? (
                <button
                  type="button"
                  className={route === "/maps/" ? "active" : ""}
                  onClick={() => navigate("/maps/")}
                >
                  Maps
                </button>
              ) : null}
            </div>
          </div>
        </nav>

        <div className="reader-top-right">
          <div
            className="publication-mode-switch"
            role="group"
            aria-label="Publication view"
          >
            <button
              type="button"
              className={publicationMode === "all" ? "active" : ""}
              onClick={() => switchPublicationMode("all")}
              title="Inspect all valid content locally"
            >
              All
            </button>
            <button
              type="button"
              className={publicationMode === "preview" ? "active" : ""}
              onClick={() => switchPublicationMode("preview")}
              title="View exactly what the active profile exports"
            >
              Preview
            </button>
          </div>
          <span
            className="publication-profile-badge"
            title="Active publication profile"
          >
            {(publicationMode === "preview"
              ? site.publication?.name
              : undefined) ??
              activePublication?.name ??
              "Default publication"}
          </span>
          <div className="mode-switch" role="group" aria-label="Reading mode">
            <button
              type="button"
              className={mode === "web" ? "active" : ""}
              onClick={() => setMode("web")}
            >
              Web
            </button>
            <button
              type="button"
              className={mode === "book" ? "active" : ""}
              onClick={() => setMode("book")}
            >
              Book
            </button>
          </div>
          <SearchBox site={site} navigate={navigate} />
          <button
            type="button"
            className={`reader-icon-button ${site.warnings.length ? "has-warning" : ""}`}
            onClick={() => setShowDiagnostics((open) => !open)}
            aria-expanded={showDiagnostics}
            title={`Diagnostics${site.warnings.length ? ` (${site.warnings.length})` : ""}`}
          >
            <FileWarning size={15} />
            {site.warnings.length ? (
              <span className="warning-count">{site.warnings.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => openSettings("app")}
            aria-expanded={showSettings}
            title="Settings"
          >
            <Settings size={15} />
          </button>
          <button
            type="button"
            className="reader-icon-button"
            onClick={() => setShowFeedback(true)}
            title="Enviar feedback"
            aria-label="Enviar feedback"
          >
            <MessageSquareText size={15} />
          </button>
          <button
            type="button"
            className="reader-icon-button"
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {activeThemeIsDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </div>

      {showSettings ? (
        <SettingsDialog
          section={settingsSection}
          onSectionChange={changeSettingsSection}
          onClose={() => setShowSettings(false)}
          localePreference={
            suiteChrome?.suiteSettings?.localePreference ??
            settings.localePreference
          }
          onLocalePreferenceChange={(localePreference) =>
            suiteChrome?.suiteSettings
              ? suiteChrome.suiteSettings.onLocalePreferenceChange(
                  localePreference,
                )
              : setSettings((current) => ({ ...current, localePreference }))
          }
          onOpenDocs={() => void openExternal(COMPENDIUM_DOCS_URL)}
          appearance={
            <>
              <label className="typography-setting">
                <span>Style</span>
                <select
                  value={suiteChrome?.suiteSettings?.style ?? settings.theme}
                  onChange={(event) =>
                    suiteChrome?.suiteSettings
                      ? suiteChrome.suiteSettings.onStyleChange(
                          event.target.value,
                        )
                      : setStandaloneStyle(event.target.value as ThemeId)
                  }
                >
                  {THEMES.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
              <TypographySettings
                value={effectivePrimaryFont}
                onChange={setPrimaryFont}
              />
            </>
          }
          suiteSettings={suiteChrome?.suiteSettings}
          universe={
            <div className="universe-settings-summary">
              <UniverseProfileEditor site={site} onSave={saveUniverseProfile} />
              {indexedUniverse ? (
                <PublicationManager
                  indexed={indexedUniverse}
                  profiles={publicationProfiles}
                  activeProfileId={activePublicationId}
                  onSave={savePublicationProfile}
                  onActivate={activatePublicationProfile}
                  onDelete={deletePublicationProfile}
                  onPreview={previewPublicationProfile}
                />
              ) : null}
              <small>{site.vaultPath}</small>
              <button
                type="button"
                onClick={() => void revealVault(site.vaultPath)}
              >
                Show in Explorer
              </button>
            </div>
          }
        />
      ) : null}

      {showDiagnostics ? (
        <aside className="diagnostics-drawer" aria-label="Universe diagnostics">
          <header>
            <div>
              <span>Publication health</span>
              <h2>Diagnostics</h2>
            </div>
            <button type="button" onClick={() => setShowDiagnostics(false)}>
              ×
            </button>
          </header>
          <div
            className={`diagnostics-summary ${site.warnings.length ? "warning" : "clean"}`}
          >
            <Wrench size={18} />
            <div>
              <strong>
                {site.warnings.length
                  ? `${site.warnings.length} issue${site.warnings.length === 1 ? "" : "s"} to review`
                  : "Everything reads cleanly"}
              </strong>
              <p>Compendium reports problems without changing source files.</p>
            </div>
          </div>
          {site.warnings.length ? (
            <ul>
              {site.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>
                  <FileWarning size={15} />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <footer>
            <p>Found a factual or writing error while reading?</p>
            <button
              type="button"
              disabled={!site.entities.find((entity) => entity.route === route)}
              onClick={() =>
                setCorrectionEntity(
                  site.entities.find((entity) => entity.route === route),
                )
              }
            >
              Suggest correction to this entry
            </button>
          </footer>
        </aside>
      ) : null}

      {loadState === "error" && errorMessage ? (
        <div className="reader-status">{errorMessage}</div>
      ) : null}

      <Reader
        site={site}
        mode={mode}
        route={route}
        navigate={navigate}
        refresh={() => void readCurrentUniverse()}
        onSuggestCorrection={setCorrectionEntity}
      />
      {correctionEntity ? (
        <CorrectionDialog
          site={site}
          entity={correctionEntity}
          onClose={() => setCorrectionEntity(undefined)}
        />
      ) : null}
      {showFeedback ? (
        <FeedbackModal
          screen="reader"
          onClose={() => setShowFeedback(false)}
          onOpenExternal={openExternal}
        />
      ) : null}
    </main>
  );
}

export default App;
