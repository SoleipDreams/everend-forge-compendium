import { mergeUniverseProfile, readUniverseProfileSource } from "./universeProfilePersistence";
import { ApplicationActivity } from "./applicationActivity";
import { useSettingsDraft, SettingsDraftBar } from "./SettingsFrame";
import { useLearningAdapter, useLearningReporter } from "./learning";
import { compendiumIntroduction, compendiumLessons } from "./learningCatalog";
import { NotificationProvider, NotificationBell, useNotificationMessage } from "./notifications";
import { formatCompendiumDiagnostic } from "./components/compendiumPresentation";
import { useCompendiumText } from "./components/compendiumPresentation";
import { CompendiumWorkspace } from "./components/CompendiumWorkspace";
import {
  CompendiumLocale,
  CompendiumMenu,
} from "./components/compendiumPresentation";
import { SceneChoices } from "./SceneChoices";
import { normalizeBackgroundScene } from "./backgroundScenes";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import "./App.css";
import "./forgeUi.css";
import "./compendiumWorkspace.css";
import "./forgeMotion.css";
import "./forgeAmbient.css";
import "./windowChrome.css";
import { emit, listen } from "@tauri-apps/api/event";
import { DesktopMenuBar } from "./components/DesktopMenuBar";
import {
  WindowChromeSetup,
  WindowTitleControls,
  useStandaloneWindowClose,
} from "./components/WindowTitleControls";
import { handleWindowTitlebarMouseDown } from "./windowTitlebar";
import { DeferredUniverseWrite } from "./lib/deferredUniverseWrite";
import { useActiveAppKeydown } from "./useActiveAppKeydown";
import {
  useUniverseSwitchGuard,
  type RegisterUniverseSwitchGuard,
} from "./useUniverseSwitchGuard";
import {
  BookOpen,
  Castle,
  ExternalLink,
  FileWarning,
  FolderOpen,
  Globe2,
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
import { SearchBox } from "./components/SearchBox";
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
import { applyInterfaceLocale, resolveInterfaceLocale } from "./i18n";
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
  normalizePrimaryFont,
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

function ForgeLogo() {
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
type SettingsScope = "general" | "app" | "universe" | "about" | "suite" | "update";

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
  registerUniverseSwitchGuard,
  localePreference,
}: {
  site: SiteData;
  localePreference: "en" | "es" | "system";
  onSave: (profile: UniverseProfile) => Promise<void>;
  registerUniverseSwitchGuard?: RegisterUniverseSwitchGuard;
}) {
  const t = useCompendiumText();
  const [draft, setDraft] = useState<UniverseProfile>(() => ({
    name: site.universeProfile?.name ?? site.title,
    icon: site.universeProfile?.icon ?? { type: "preset", value: "book" },
  }));
  const [saving, setSaving] = useState(false);
  const [savedDraft, setSavedDraft] = useState<UniverseProfile>(() => ({ name: site.universeProfile?.name ?? site.title, icon: site.universeProfile?.icon ?? { type: "preset", value: "book" } }));
  const [saveError, setSaveError] = useState("");
  const baseline = savedDraft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const draftRef = useRef(draft); draftRef.current = draft;
  const pathRef = useRef(site.vaultPath);
  const discard = () => { const value = {name:site.universeProfile?.name ?? site.title, icon:site.universeProfile?.icon ?? {type:"preset" as const,value:"book"}}; setDraft(value); setSavedDraft(value); setSaveError(""); };
  const save = async () => { const snapshot = draftRef.current; setSaving(true); setSaveError(""); try { await onSave(snapshot); setSavedDraft(snapshot); } catch (error) { setSaveError(String(error)); throw error; } finally { setSaving(false); } };
  const settingsDraft = {dirty, busy:saving, save, discard};
  useSettingsDraft("compendium.universe-profile", settingsDraft);
  useUniverseSwitchGuard(
    registerUniverseSwitchGuard,
    saving || JSON.stringify(draft) !== JSON.stringify(baseline),
  );

  useEffect(() => {
    if (pathRef.current !== site.vaultPath || !dirty) discard();
    pathRef.current = site.vaultPath;
  }, [
    site.vaultPath,
    site.universeProfile?.name,
    site.universeProfile?.icon?.type,
    site.universeProfile?.icon?.value,
  ]);

  return (
    <fieldset className="universe-profile-editor" disabled={saving}>
      <UniverseIconFrame profile={draft} size={48} />
      <div className="universe-profile-fields">
        <label>
          <span>{t("Universe name", "Nombre del universo")}</span>
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
              title={t(`Use ${value} icon`, `Usar icono ${value}`)}
            >
              <Icon size={16} />
            </button>
          ))}
          <label
            className="image-upload-button"
            title={t("Use PNG or JPG", "Usa PNG o JPG")}
          >
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

        {saveError ? <p role="alert">{saveError}</p> : null}
        <SettingsDraftBar draft={settingsDraft} locale={resolveInterfaceLocale(localePreference)} />
      </div>
    </fieldset>
  );
}

function TypographySettings({
  value,
  onChange,
}: {
  value: PrimaryFontId;
  onChange: (font: PrimaryFontId) => void;
}) {
  const t = useCompendiumText();
  return (
    <label className="typography-setting">
      <span>{t("Primary typeface", "Fuente de lectura")}</span>
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

const STARTUP_LOADER_MIN_MS = 0;

function CompendiumApp({ suiteChrome }: { suiteChrome?: SuiteChrome } = {}) {
  const appActiveRef = useRef(suiteChrome?.active !== false);
  appActiveRef.current = suiteChrome?.active !== false;
  const [settings, setSettings] = useState<CompendiumSettings>(() =>
    loadSettings(),
  );
  const interfaceLocale = resolveInterfaceLocale(
    suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference,
  );
  const t = (en: string, es: string) => (interfaceLocale === "es" ? es : en);
  useEffect(() => {
    applyInterfaceLocale(
      suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference,
    );
  }, [settings.localePreference, suiteChrome?.suiteSettings?.localePreference]);
  const [view, setView] = useState<AppView>("home");
  const [showProductPlan, setShowProductPlan] = useState(false);
  const [productPlanView, setProductPlanView] = useState<
    ComponentType<{ onClose: () => void }>
  >();
  const ProductPlanView = productPlanView;
  const openProductPlan = async () => {
    if (!import.meta.env.DEV) return;
    const plan = await import("./components/CompendiumProductPlan");
    setProductPlanView(() => plan.CompendiumProductPlan);
    setShowProductPlan(true);
  };
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
  useNotificationMessage(loadState === "error" ? formatCompendiumDiagnostic(errorMessage, interfaceLocale) : undefined, "error");
  const [mode, setMode] = useState<ReaderMode>("web");
  const [route, setRoute] = useState("/");
  const [forgeMenuOpen, setForgeMenuOpen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  useEffect(() => suiteChrome?.registerSettingsOpener?.((section) => {
    if (section) setSettingsScope(section);
    setShowSettings(true);
  }), [suiteChrome?.registerSettingsOpener]);
  const [showPublication, setShowPublication] = useState(
    () => settings.explorer?.section === "publication",
  );
  const [settingsScope, setSettingsScope] = useState<SettingsScope>("app");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const reportLearning = useLearningReporter(suiteChrome?.learning, site?.vaultPath);
  const [correctionEntity, setCorrectionEntity] = useState<Entity>();
  const forgeMenuRef = useRef<HTMLDivElement | null>(null);
  const appliedPresetRef = useRef<string | undefined>(undefined);
  const recentUniverseAttemptedRef = useRef<string | undefined>(undefined);
  const startupStartedAtRef = useRef(Date.now());
  const startupReadyTimerRef = useRef<number | undefined>(undefined);
  /** Serialized appearance last known to match `.everend/.compendium/appearance.json` on disk. */
  const vaultAppearanceOnDiskRef = useRef<string | undefined>(undefined);
  const appearanceWriter = useRef(new DeferredUniverseWrite());
  const editorGuards = useRef(new Set<() => Promise<boolean>>());
  const registerEditorGuard: RegisterUniverseSwitchGuard = useCallback(
    (guard) => {
      editorGuards.current.add(guard);
      return () => {
        editorGuards.current.delete(guard);
      };
    },
    [],
  );
  const prepareUniverseSwitch = useCallback(async () => {
    if (!(await appearanceWriter.current.flush())) {
      setErrorMessage(
        t(
          "Could not save reading appearance. Retry before switching universes.",
          "No se pudo guardar la apariencia de lectura. Reintenta antes de cambiar de universo.",
        ),
      );
      setLoadState("error");
      return false;
    }
    for (const guard of editorGuards.current) {
      if (!(await guard())) {
        setErrorMessage(
          t(
            "Unsaved changes: finish the publication, customization or correction before switching universes.",
            "Hay cambios sin guardar: resuelve Publicación, la personalización o la corrección antes de cambiar de universo.",
          ),
        );
        setLoadState("error");
        return false;
      }
    }
    return true;
  }, [interfaceLocale]);
  useStandaloneWindowClose(!suiteChrome, prepareUniverseSwitch);
  useEffect(
    () => suiteChrome?.registerUniverseSwitchGuard?.(prepareUniverseSwitch),
    [suiteChrome?.registerUniverseSwitchGuard, prepareUniverseSwitch],
  );
  useEffect(() => () => appearanceWriter.current.cancelTimer(), []);

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
    if (!suiteChrome) document.documentElement.dataset.theme = settings.theme;
    document
      .querySelector<HTMLElement>(".forge-compendium")
      ?.setAttribute(
        "data-ambient-background",
        String(
          suiteChrome?.suiteSettings?.ambientBackground ??
            settings.ambientBackground !== false,
        ),
      );
    document
      .querySelector<HTMLElement>(".forge-compendium")
      ?.setAttribute(
        "data-background-scene",
        normalizeBackgroundScene(
          suiteChrome?.suiteSettings?.backgroundScene ??
            settings.backgroundScene,
        ),
      );
    saveSettings(settings);
  }, [settings, suiteChrome]);

  useEffect(() => {
    const vaultPath = site?.vaultPath;
    if (!vaultPath || !isTauriRuntime()) return;
    const content = serializeVaultAppearanceSettings(settings);
    if (vaultAppearanceOnDiskRef.current === content) return;
    appearanceWriter.current.schedule(async () => {
      const result = await saveUniverseTextFile(
        vaultPath,
        VAULT_APPEARANCE_SETTINGS_PATH,
        content,
      );
      if (!result.ok)
        throw new Error(
          result.message ??
            t(
              "Could not save appearance.",
              "No se pudo guardar la apariencia.",
            ),
        );
      vaultAppearanceOnDiskRef.current = content;
    });
  }, [settings, site?.vaultPath]);

  useEffect(() => {
    if (!forgeMenuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (!appActiveRef.current) return;
      if (forgeMenuRef.current?.contains(event.target as Node)) return;
      setForgeMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [forgeMenuOpen]);

  useActiveAppKeydown(suiteChrome?.active, (event) => {
    if (event.key === "Escape") {
      setShowSettings(false);
      setShowDiagnostics(false);
      setForgeMenuOpen(false);
      return;
    }
    // Native menu accelerators remain on macOS; standalone custom chrome owns
    // the same shortcuts on Windows and Linux.
    if (
      suiteChrome ||
      !isTauriRuntime() ||
      /Mac|iPhone|iPad/.test(navigator.platform) ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey
    )
      return;
    const key = event.key.toLowerCase();
    const id = event.shiftKey
      ? key === "l"
        ? "cp:view:toggle-light-dark"
        : undefined
      : (
          {
            o: "cp:file:open-universe",
            "1": "cp:view:mode-web",
            "2": "cp:view:mode-book",
            r: "cp:view:reload",
          } as Record<string, string>
        )[key];
    if (id) {
      event.preventDefault();
      void emit("compendium-menu", id);
    }
  });

  const navigate = useCallback((nextRoute: string) => {
    setRoute(nextRoute);
    if (nextRoute !== "/") reportLearning("content-opened");
  }, [reportLearning]);

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
        t(
          "Open Everend Compendium as a desktop app to choose a universe folder.",
          "Abre la aplicación de escritorio para seleccionar la carpeta de un universo.",
        ),
      );
      return;
    }
    const path = await openVaultDialog();
    if (path && (await prepareUniverseSwitch())) await loadUniverse(path);
  }, [loadUniverse, prepareUniverseSwitch]);

  const openRecentUniverse = useCallback(
    async (path?: string) => {
      const target = path ?? settings.recentUniverse;
      if (target && (await prepareUniverseSwitch())) await loadUniverse(target);
    },
    [loadUniverse, prepareUniverseSwitch, settings.recentUniverse],
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

  const effectivePrimaryFont = settings.primaryFont as PrimaryFontId;
  const setPrimaryFont = useCallback((primaryFont: PrimaryFontId) => { setSettings(current => ({...current, primaryFont})); }, []);

  const setStandaloneStyle = useCallback((theme: ThemeId) => {
    setSettings((current) => ({ ...current, theme }));
  }, []);

  const ambientBackgroundControl = (
    <label className="typography-setting">
      <span>
        {interfaceLocale === "es" ? "Fondo difuminado" : "Soft background"}
      </span>
      <input
        type="checkbox"
        checked={
          suiteChrome?.suiteSettings?.ambientBackground ??
          settings.ambientBackground !== false
        }
        onChange={(event) =>
          suiteChrome?.suiteSettings?.onAmbientBackgroundChange
            ? suiteChrome.suiteSettings.onAmbientBackgroundChange(
                event.target.checked,
              )
            : setSettings((current) => ({
                ...current,
                ambientBackground: event.target.checked,
              }))
        }
      />
    </label>
  );

  const openSettings = useCallback((scope: SettingsScope) => {
    setSettingsScope(scope);
    setShowSettings(true);
  }, []);

  const settingsSection: SettingsSection =
    settingsScope === "app" ? "appearance" : settingsScope;

  const changeSettingsSection = useCallback((section: SettingsSection) => {
    setSettingsScope(section === "appearance" ? "app" : section);
  }, []);

  useEffect(() => {
    if (!suiteChrome?.settingsHost || !site?.vaultPath) return;
    const root = site.vaultPath;
    const refresh = (event: Event) => { if ((event as CustomEvent<{path:string}>).detail?.path !== root) return;
      void readUniverseProfileSource(root).then(source => {
        const profile = source ? JSON.parse(source) as UniverseProfile : undefined;
        setSite(current => current?.vaultPath === root ? {...current,universeProfile:profile,title:profile?.name ?? current.config.site?.title ?? universePathName(root)} : current);
        setIndexedUniverse(current => current?.vaultPath === root ? {...current,universeProfile:profile,title:profile?.name ?? current.config.site?.title ?? universePathName(root)} : current);
      }).catch(error => console.warn("Could not refresh universe profile.",error));
    };
    window.addEventListener("everend-forge:profile-saved",refresh); return () => window.removeEventListener("everend-forge:profile-saved",refresh);
  }, [suiteChrome?.settingsHost !== undefined, site?.vaultPath]);
  const saveUniverseProfile = useCallback(
    async (profile: UniverseProfile) => {
      if (!site) throw new Error("Open a universe before saving its profile.");
      if (suiteChrome?.sharedUniversePath && site.vaultPath.replace(/\\/g, "/") !== suiteChrome.sharedUniversePath.replace(/\\/g, "/")) throw new Error("The selected universe is still loading.");
      const normalizedProfile = mergeUniverseProfile(await readUniverseProfileSource(site.vaultPath), { name: profile.name?.trim() || undefined, icon: profile.icon }) as UniverseProfile;
      const result = await saveUniverseTextFile(
        site.vaultPath,
        ".everend/universe.json",
        `${JSON.stringify(normalizedProfile, null, 2)}\n`,
      );
      if (!result.ok)
        throw new Error(
          result.message ??
            t(
              "Could not save universe profile.",
              "No se pudo guardar el perfil del universo.",
            ),
        );
      setSite(current => current ? {...current, universeProfile:normalizedProfile, title:normalizedProfile.name ?? current.config.site?.title ?? universePathName(current.vaultPath)} : current);
      setIndexedUniverse(current => current ? {...current, universeProfile:normalizedProfile, title:normalizedProfile.name ?? current.config.site?.title ?? universePathName(current.vaultPath)} : current);
      suiteChrome?.settingsHost?.profileSaved(site.vaultPath);
    },
    [site, interfaceLocale, suiteChrome?.sharedUniversePath, suiteChrome?.settingsHost?.profileSaved],
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
          result.message ??
            t(
              "Could not save publication profile.",
              "No se pudo guardar el perfil de publicación.",
            ),
        );
      }
      setPublicationProfiles((current) => {
        const next = current.filter((item) => item.id !== profile.id);
        return [...next, profile].sort((left, right) =>
          left.name.localeCompare(right.name),
        );
      });
    },
    [site, interfaceLocale],
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
          result.message ??
            t(
              "Could not activate publication profile.",
              "No se pudo activar el perfil de publicación.",
            ),
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
    [applySite, indexedUniverse, site, interfaceLocale],
  );

  const deletePublicationProfile = useCallback(
    async (profile: PublicationProfile) => {
      if (!site || publicationProfiles.length <= 1) {
        throw new Error(
          t(
            "Keep at least one publication profile.",
            "Conserva al menos un perfil de publicación.",
          ),
        );
      }
      const result = await deleteUniverseFile(
        site.vaultPath,
        publicationRelativePath(profile.id),
      );
      if (!result.ok) {
        throw new Error(
          result.message ??
            t(
              "Could not delete publication profile.",
              "No se pudo eliminar el perfil de publicación.",
            ),
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
      interfaceLocale,
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
      setShowPublication(false);
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
      if (!appActiveRef.current) return;
      if (event.payload === "cp:file:open-universe") void openUniverse();
      if (event.payload === "cp:file:reveal-universe" && site) {
        void revealVault(site.vaultPath);
      }
      if (event.payload === "cp:view:toggle-light-dark") toggleTheme();
      if (event.payload === "cp:view:mode-web") setMode("web");
      if (event.payload === "cp:view:mode-book") setMode("book");
      if (event.payload === "cp:app:settings") openSettings("app");
      if (event.payload === "cp:help:feedback") setShowFeedback(true);
      if (event.payload === "cp:view:reload")
        void prepareUniverseSwitch().then((ready) => {
          if (ready) {
            if (suiteChrome?.onReload) suiteChrome.onReload();
            else window.location.reload();
          }
        });
      if (event.payload === "cp:help:about") {
        openSettings("about");
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
  }, [
    openUniverse,
    site,
    toggleTheme,
    prepareUniverseSwitch,
    openSettings,
    suiteChrome?.onReload,
  ]);

  async function readCurrentUniverse() {
    if (site && (await prepareUniverseSwitch()))
      await loadUniverse(site.vaultPath);
  }

  async function openHome() {
    if (suiteChrome?.onHome) {
      suiteChrome.onHome();
      return;
    }
    if (await prepareUniverseSwitch()) setView("home");
  }

  const appSwitcher = suiteChrome ? (
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
            void openHome();
            setForgeMenuOpen(false);
          }}
        >
          {t("Compendium Home", "Inicio de Compendium")}{" "}
        </button>
        <button
          type="button"
          onClick={() => {
            void openUniverse();
            setForgeMenuOpen(false);
          }}
        >
          {t("Open Universe…", "Abrir universo…")}{" "}
        </button>
        <button
          type="button"
          onClick={() => {
            openSettings("app");
            setForgeMenuOpen(false);
          }}
        >
          {t("Settings…", "Ajustes…")}
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
            void openExternal(BUY_SUITE_URL).then(() => setForgeMenuOpen(false))
          }
        >
          {t("Buy Suite", "Comprar Suite")}
        </button>
        <button
          type="button"
          onClick={() => {
            setForgeMenuOpen(false);
            setShowFeedback(true);
          }}
        >
          {t("Send feedback", "Enviar comentarios")}{" "}
        </button>
        <button
          type="button"
          onClick={() => {
            openSettings("about");
            setForgeMenuOpen(false);
          }}
        >
          {t("About Compendium", "Acerca de Compendium")}{" "}
        </button>
      </div>
      <button
        type="button"
        className="forge-corner-button"
        onClick={() => setForgeMenuOpen((open) => !open)}
        aria-expanded={forgeMenuOpen}
        aria-label={t("Open Everend menu", "Abrir menú de Everend")}
        title={t("Everend menu", "Menú de Everend")}
      >
        <ForgeLogo />
      </button>
    </div>
  );

  useLearningAdapter(suiteChrome?.learning, {
    introduction: compendiumIntroduction, lessons: compendiumLessons,
    available: Boolean(site && indexedUniverse && loadState !== "loading"),
    busy: showSettings || showFeedback, section: showDiagnostics ? "diagnostics" : showPublication ? "publication" : "reading",
    openSection: (section, userInitiated) => {
      if (!site) return;
      setView("reader");
      setShowPublication(section === "publication");
      if (section === "diagnostics") {
        setShowDiagnostics(true);
        if (userInitiated) reportLearning("diagnostics-opened");
      }
    },
  });

  if (!suiteChrome && !initialReady) {
    return (
      <div className="home-shell cp-startup-shell">
        <header
          className="home-topbar"
          onMouseDown={handleWindowTitlebarMouseDown}
        >
          <div className="compendium-topbar-leading">
            {appSwitcher}
            <DesktopMenuBar
              locale={interfaceLocale}
              onHome={() => {
                void openHome();
              }}
              hasUniverse={Boolean(site)}
            />
            <strong>Compendium</strong>
          </div>
          <WindowTitleControls locale={interfaceLocale} />
        </header>
        <BrandLoadingScreen
          message={
            loadState === "loading"
              ? t("Opening your universe…", "Abriendo tu universo…")
              : t(
                  "Preparing your reading space…",
                  "Preparando tu espacio de lectura…",
                )
          }
        />
      </div>
    );
  }

  if (view === "home" || !site) {
    if (suiteChrome?.sharedUniversePath) {
      return (
        <CompendiumLocale.Provider value={interfaceLocale}>
          <main
            className="compendium-shell cp-shared-loading-shell"
            aria-busy={loadState === "loading"}
          >
            <header className="home-topbar">
              <div className="compendium-topbar-leading">
                {appSwitcher}
                <strong>Compendium</strong>
              </div>
            </header>
            <div className="cp-shared-loading-content">
              <p>
                {loadState === "error"
                  ? formatCompendiumDiagnostic(errorMessage, interfaceLocale)
                  : interfaceLocale === "es"
                    ? "Abriendo el universo compartido…"
                    : "Opening the shared universe…"}
              </p>
              {loadState === "error" ? (
                <button type="button" onClick={suiteChrome.onHome}>
                  {interfaceLocale === "es"
                    ? "Elegir otro universo"
                    : "Choose another universe"}
                </button>
              ) : null}
            </div>
          </main>
        </CompendiumLocale.Provider>
      );
    }

    return (
      <CompendiumLocale.Provider value={interfaceLocale}>
        <main className={`home-shell ${!suiteChrome ? "cp-standalone" : ""}`}>
          <header
            className="home-topbar"
            onMouseDown={
              !suiteChrome ? handleWindowTitlebarMouseDown : undefined
            }
          >
            <div className="compendium-topbar-leading">
              {appSwitcher}
              {!suiteChrome ? (
                <DesktopMenuBar
                  locale={interfaceLocale}
                  onHome={() => {
                    void openHome();
                  }}
                  hasUniverse={Boolean(site)}
                />
              ) : null}
              <div className="brand">
                <img
                  className="app-brand-icon"
                  src={compendiumIcon}
                  alt=""
                  aria-hidden="true"
                />
                <div>
                  <h1>Compendium</h1>
                  <p>
                    {t(
                      "A readable edition of your universe",
                      "Una edición de lectura de tu universo",
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="header-actions">
              <button
                type="button"
                className="icon-button"
                onClick={() => openSettings("app")}
                aria-expanded={showSettings}
                title={t("Settings", "Ajustes")}
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowFeedback(true)}
                title={t("Send feedback", "Enviar comentarios")}
                aria-label={t("Send feedback", "Enviar comentarios")}
              >
                <MessageSquareText size={16} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={toggleTheme}
                title={t("Toggle theme", "Cambiar tema")}
                aria-label={t("Toggle theme", "Cambiar tema")}
              >
                {activeThemeIsDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <NotificationBell locale={interfaceLocale} />
              {!suiteChrome ? (
                <WindowTitleControls locale={interfaceLocale} />
              ) : null}
            </div>
          </header>
          {(showSettings || suiteChrome?.settingsHost) ? (
            <SettingsDialog
              visible={showSettings}
              active={suiteChrome?.active}
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
              appearance={<>
<TypographySettings
                    value={effectivePrimaryFont}
                    onChange={setPrimaryFont}
                  />
</>}
generalAppearance={<>{!suiteChrome?.suiteSettings && <label><span>{t("Interface typeface","Fuente de interfaz")}</span><select value={settings.interfaceFont ?? "sans"} onChange={event => setSettings(current => ({...current,interfaceFont:normalizePrimaryFont(event.target.value)}))}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="humanist">Humanist</option></select></label>}

<label className="typography-setting">
                    <span>{t("Style", "Estilo")}</span>
                    <select
                      value={
                        suiteChrome?.suiteSettings?.style ?? settings.theme
                      }
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

<label><span>{t("Theme mode", "Modo del tema")}</span><button type="button" onClick={toggleTheme}>{t("Toggle light / dark", "Cambiar claro / oscuro")}</button></label>
{ambientBackgroundControl}

<SceneChoices
                    locale={interfaceLocale}
                    scene={
                      suiteChrome?.suiteSettings?.backgroundScene ??
                      settings.backgroundScene
                    }
                    onScene={(backgroundScene) =>
                      suiteChrome?.suiteSettings?.onBackgroundSceneChange
                        ? suiteChrome.suiteSettings.onBackgroundSceneChange(
                            backgroundScene,
                          )
                        : setSettings((current) => ({
                            ...current,
                            backgroundScene,
                          }))
                    }
                  />


</>}
settingsHost={suiteChrome?.settingsHost}
publication={site ? () => setShowPublication(true) : undefined}
              suiteSettings={suiteChrome?.suiteSettings}
            />
          ) : null}
          <section className="home-panel">
            <div className="home-hero">
              <div className="home-copy">
                <p className="eyebrow">{t("Home", "Inicio")}</p>
                <h2>{t("Choose a universe", "Escoge un universo")}</h2>
                <p>
                  {t(
                    "Open a WorldNotion vault to read its published canon and stories as a living book.",
                    "Abre un universo de WorldNotion para leer su canon y sus historias.",
                  )}{" "}
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
                    <span className="eyebrow">
                      {t("Continue reading", "Continuar leyendo")}
                    </span>
                    <strong>{universeDisplayName(site)}</strong>
                    <span>
                      {site.entities.length} {t("entries", "fichas")} ·{" "}
                      {site.stories.length} {t("stories", "historias")}{" "}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
            <div className="home-actions">
              {import.meta.env.DEV ? (
                <button type="button" onClick={() => void openProductPlan()}>
                  <Sparkles size={16} />
                  {t("Explore product plan", "Explorar plan de producto")}
                </button>
              ) : null}
              <button
                type="button"
                className="primary-action"
                onClick={openUniverse}
              >
                <FolderOpen size={16} />
                {t("Open Universe", "Abrir universo")}{" "}
              </button>
              {settings.recentUniverse ? (
                <button type="button" onClick={() => void openRecentUniverse()}>
                  <BookOpen size={16} />
                  {t("Open Recent", "Abrir reciente")}{" "}
                </button>
              ) : null}
            </div>
            {loadState === "loading" ? (
              <p className="home-status">
                {t("Opening universe...", "Abriendo universo…")}
              </p>
            ) : null}

            {settings.recentUniverses.length > 0 ? (
              <div className="recent-section">
                <p className="eyebrow">
                  {t("Recent universes", "Universos recientes")}
                </p>
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
          {showProductPlan && ProductPlanView && import.meta.env.DEV ? (
            <ProductPlanView onClose={() => setShowProductPlan(false)} />
          ) : null}
        </main>
      </CompendiumLocale.Provider>
    );
  }

  const activePublication = indexedUniverse
    ? profileForId(
        publicationProfiles,
        activePublicationId,
        indexedUniverse.config,
      )
    : undefined;

  return (
    <CompendiumLocale.Provider value={interfaceLocale}>
      <main
        className={`app-shell compendium-shell ${suiteChrome ? "suite-mode" : "cp-standalone"}`}
        style={
          {
            "--ef-primary-font": primaryFontCssValue((suiteChrome?.suiteSettings?.primaryFont ?? settings.interfaceFont ?? "sans") as PrimaryFontId),
            "--ef-reader-font": primaryFontCssValue(effectivePrimaryFont),
          } as CSSProperties
        }
      >
        <div
          className="reader-top-bar"
          aria-label={t("Reader controls", "Controles de lectura")}
          onMouseDown={!suiteChrome ? handleWindowTitlebarMouseDown : undefined}
        >
          {appSwitcher}

          <div className="reader-top-left">
            {!suiteChrome ? (
              <DesktopMenuBar
                locale={interfaceLocale}
                onHome={() => {
                  void openHome();
                }}
                hasUniverse
              />
            ) : null}
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
              </span>
            </button>

            <button
              type="button"
              className="reader-icon-button"
              onClick={() => openSettings("app")}
              title={t("Application settings", "Ajustes de la aplicación")}
              aria-label={t("Application settings", "Ajustes de la aplicación")}
            >
              <Settings size={14} />
            </button>
            <button
              type="button"
              className="reader-icon-button"
              onClick={() => void revealVault(site.vaultPath)}
              title={t(
                "Show universe in Finder",
                "Mostrar universo en el explorador",
              )}
            >
              <ExternalLink size={15} />
            </button>
          </div>

          <div className="reader-top-right">
            <CompendiumMenu label={t("View", "Vista")}>
              <div
                className="publication-mode-switch"
                role="group"
                aria-label={t("Publication view", "Vista de publicación")}
              >
                <button
                  type="button"
                  className={publicationMode === "all" ? "active" : ""}
                  onClick={() => switchPublicationMode("all")}
                  title={t(
                    "Inspect all valid content locally",
                    "Examinar todo el contenido válido",
                  )}
                >
                  {interfaceLocale === "es" ? "Todo" : "All"}
                </button>
                <button
                  type="button"
                  className={publicationMode === "preview" ? "active" : ""}
                  onClick={() => switchPublicationMode("preview")}
                  title={t(
                    "View exactly what the active profile exports",
                    "Ver el contenido que exporta el perfil activo",
                  )}
                >
                  {interfaceLocale === "es" ? "Vista previa" : "Preview"}
                </button>
              </div>
              <span
                className="publication-profile-badge"
                title={t(
                  "Active publication profile",
                  "Perfil de publicación activo",
                )}
              >
                {(publicationMode === "preview"
                  ? site.publication?.name
                  : undefined) ??
                  activePublication?.name ??
                  t("Default publication", "Publicación predeterminada")}
              </span>
              <div
                className="mode-switch"
                role="group"
                aria-label={t("Reading mode", "Modo de lectura")}
              >
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
                  {t("Book · soon", "Libro · próximamente")}{" "}
                </button>
              </div>
            </CompendiumMenu>
            <SearchBox
              site={site}
              navigate={(next) => {
                setShowPublication(false);
                navigate(next);
              }}
            />
            <button
              type="button"
              className={`reader-icon-button ${site.warnings.length ? "has-warning" : ""}`}
              onClick={() => { setShowDiagnostics(open => !open); if (!showDiagnostics) reportLearning("diagnostics-opened"); }}
              aria-expanded={showDiagnostics}
              aria-label={`${t("Diagnostics", "Diagnóstico")}${site.warnings.length ? ` (${site.warnings.length})` : ""}`}
              title={`${t("Diagnostics", "Diagnóstico")}${site.warnings.length ? ` (${site.warnings.length})` : ""}`}
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
              title={t("Settings", "Ajustes")}
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              className="reader-icon-button"
              onClick={() => setShowFeedback(true)}
              title={t("Send feedback", "Enviar comentarios")}
              aria-label={t("Send feedback", "Enviar comentarios")}
            >
              <MessageSquareText size={15} />
            </button>
            <button
              type="button"
              className="reader-icon-button"
              onClick={toggleTheme}
              title={t("Toggle theme", "Cambiar tema")}
              aria-label={t("Toggle theme", "Cambiar tema")}
            >
              {activeThemeIsDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <NotificationBell locale={interfaceLocale} />
          </div>
          {!suiteChrome ? (
            <WindowTitleControls locale={interfaceLocale} />
          ) : null}
        </div>

        <div hidden={!showSettings && !suiteChrome?.settingsHost}>
          <SettingsDialog
            visible={showSettings}
            active={suiteChrome?.active}
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
            appearance={<>
<TypographySettings
                  value={effectivePrimaryFont}
                  onChange={setPrimaryFont}
                />
</>}
generalAppearance={<>{!suiteChrome?.suiteSettings && <label><span>{t("Interface typeface","Fuente de interfaz")}</span><select value={settings.interfaceFont ?? "sans"} onChange={event => setSettings(current => ({...current,interfaceFont:normalizePrimaryFont(event.target.value)}))}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="humanist">Humanist</option></select></label>}

<label className="typography-setting">
                  <span>{t("Style", "Estilo")}</span>
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

<label><span>{t("Theme mode", "Modo del tema")}</span><button type="button" onClick={toggleTheme}>{t("Toggle light / dark", "Cambiar claro / oscuro")}</button></label>
{ambientBackgroundControl}

<SceneChoices
                  locale={interfaceLocale}
                  scene={
                    suiteChrome?.suiteSettings?.backgroundScene ??
                    settings.backgroundScene
                  }
                  onScene={(backgroundScene) =>
                    suiteChrome?.suiteSettings?.onBackgroundSceneChange
                      ? suiteChrome.suiteSettings.onBackgroundSceneChange(
                          backgroundScene,
                        )
                      : setSettings((current) => ({
                          ...current,
                          backgroundScene,
                        }))
                  }
                />


</>}
settingsHost={suiteChrome?.settingsHost}
publication={site ? () => setShowPublication(true) : undefined}
            suiteSettings={suiteChrome?.suiteSettings}
            universe={
              <div className="universe-settings-summary">
                <UniverseProfileEditor
                  site={site}
                  localePreference={suiteChrome?.suiteSettings?.localePreference ?? settings.localePreference}
                  onSave={saveUniverseProfile}
                  registerUniverseSwitchGuard={registerEditorGuard}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    setShowPublication(true);
                  }}
                >
                  {t("Open publication workspace", "Abrir Publicación")}{" "}
                </button>
                <small>{site.vaultPath}</small>
                <button
                  type="button"
                  onClick={() => void revealVault(site.vaultPath)}
                >
                  {t("Show in Explorer", "Mostrar en el explorador")}{" "}
                </button>
              </div>
            }
          />
        </div>

        <CompendiumWorkspace
          site={site}
          route={route}
          publication={showPublication}
          onPublication={setShowPublication}
          onPreferencesChange={(explorer) =>
            setSettings((current) => ({ ...current, explorer }))
          }
          navigate={(next) => {
            setShowPublication(false);
            navigate(next);
          }}
        >
          {indexedUniverse ? (
            <section
              data-onboarding-target="compendium.publication" className="publication-workspace"
              hidden={!showPublication}
              aria-label={t("Publication workspace", "Publicación")}
            >
              <header className="publication-workspace-heading">
                <div>
                  <p className="chapter">Compendium</p>
                  <h1>
                    {interfaceLocale === "es" ? "Publicación" : "Publication"}
                  </h1>
                </div>
                <button type="button" onClick={() => setShowPublication(false)}>
                  {interfaceLocale === "es"
                    ? "Volver a lectura"
                    : "Back to reading"}
                </button>
              </header>
              <PublicationManager
                key={indexedUniverse.vaultPath}
                indexed={indexedUniverse}
                profiles={publicationProfiles}
                activeProfileId={activePublicationId}
                onSave={savePublicationProfile}
                onActivate={activatePublicationProfile}
                onDelete={deletePublicationProfile}
                onPreview={previewPublicationProfile}
                registerUniverseSwitchGuard={registerEditorGuard}
                onLearningAction={event => reportLearning(event)}
              />
            </section>
          ) : null}

          {showDiagnostics ? (
            <aside
              data-onboarding-target="compendium.diagnostics" className="diagnostics-drawer"
              aria-label={t("Universe diagnostics", "Diagnóstico del universo")}
            >
              <header>
                <div>
                  <span>
                    {t("Publication health", "Estado de la publicación")}
                  </span>
                  <h2>{t("Diagnostics", "Diagnóstico")}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDiagnostics(false)}
                  aria-label={t("Close diagnostics", "Cerrar diagnóstico")}
                >
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
                      ? t(
                          `${site.warnings.length} issues to review`,
                          `${site.warnings.length} problemas por revisar`,
                        )
                      : t(
                          "Everything reads cleanly",
                          "No hay problemas de lectura",
                        )}
                  </strong>
                  <p>
                    {t(
                      "Compendium reports problems without changing source files.",
                      "Compendium informa de problemas y conserva los archivos originales.",
                    )}
                  </p>
                </div>
              </div>
              {site.warnings.length ? (
                <ul>
                  {site.warnings.map((warning, index) => (
                    <li key={`${warning}-${index}`}>
                      <FileWarning size={15} />
                      <span>
                        {formatCompendiumDiagnostic(warning, interfaceLocale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <footer>
                <p>
                  {t(
                    "Found a factual or writing error while reading?",
                    "¿Encontraste un error en el contenido?",
                  )}
                </p>
                <button
                  type="button"
                  disabled={
                    !site.entities.find((entity) => entity.route === route)
                  }
                  onClick={() =>
                    setCorrectionEntity(
                      site.entities.find((entity) => entity.route === route),
                    )
                  }
                >
                  {t(
                    "Suggest correction to this entry",
                    "Sugerir corrección de esta ficha",
                  )}{" "}
                </button>
              </footer>
            </aside>
          ) : null}



          <div className="compendium-reading-surface" hidden={showPublication}>
            <Reader
              site={site}
              mode={mode}
              route={route}
              navigate={navigate}
              refresh={() => void readCurrentUniverse()}
              onSuggestCorrection={setCorrectionEntity}
            />
          </div>
        </CompendiumWorkspace>
        {correctionEntity ? (
          <CorrectionDialog
            active={suiteChrome?.active}
            site={site}
            entity={correctionEntity}
            onClose={() => setCorrectionEntity(undefined)}
            registerUniverseSwitchGuard={registerEditorGuard}
          />
        ) : null}
        {showFeedback ? (
          <FeedbackModal
            active={suiteChrome?.active}
            screen="reader"
            onClose={() => setShowFeedback(false)}
            onOpenExternal={openExternal}
          />
        ) : null}
      </main>
    </CompendiumLocale.Provider>
  );
}

export default function App(props: { suiteChrome?: SuiteChrome } = {}) {
  return (
    <div
      className="forge-compendium"
      data-ambient-background={
        props.suiteChrome?.suiteSettings?.ambientBackground ??
        loadSettings().ambientBackground !== false
      }
      data-background-scene={normalizeBackgroundScene(
        props.suiteChrome?.suiteSettings?.backgroundScene ??
          loadSettings().backgroundScene,
      )}
      data-app-active={props.suiteChrome?.active !== false}
      data-window-chrome={!props.suiteChrome && isTauriRuntime()}
    >
      {!props.suiteChrome ? <WindowChromeSetup /> : null}
      <ApplicationActivity.Provider value={props.suiteChrome?.active !== false}><NotificationProvider host={props.suiteChrome?.notifications} source="Compendium" active={props.suiteChrome?.active !== false}><CompendiumApp {...props} /></NotificationProvider></ApplicationActivity.Provider>
    </div>
  );
}
