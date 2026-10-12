import type { SettingsHost } from "./settingsIntegration";
import type { LearningHost } from "./learning";
import type { NotificationHost } from "./notifications";
import type { ReactNode } from "react";
import type { LocalePreference } from "./i18n";

export type SuiteLicenseStatus =
  "idle" | "activating" | "active" | "inactive" | "error";

export type SuiteLicenseInstance = {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SuiteLicenseControls = {
  status: SuiteLicenseStatus;
  licenseKey?: string;
  instanceName?: string;
  currentInstanceId?: string;
  activationUsage?: number;
  activationLimit?: number;
  error?: string;
  instances?: SuiteLicenseInstance[];
  devicesStatus?: "idle" | "loading" | "error";
  devicesError?: string;
  onActivate: (licenseKey: string) => void;
  onValidate: () => void;
  onDeactivate: () => void;
  onLoadDevices: () => void;
  onDeactivateDevice: (instanceId: string) => void;
};

export type SuiteSettings = {
  /** Optional visual preference; older hosts retain the default atmosphere. */
  ambientBackground?: boolean;
  backgroundScene?: string;
  onBackgroundSceneChange?: (scene: string) => void;
  onAmbientBackgroundChange?: (enabled: boolean) => void;
  localePreference: LocalePreference;
  locale: "en" | "es";
  onLocalePreferenceChange: (preference: LocalePreference) => void;
  primaryFont: string;
  onPrimaryFontChange: (font: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  onToggleStyleMode: () => void;
  update: SuiteUpdateControls;
  license: SuiteLicenseControls;
};

export type SuiteUpdateStatus =
  "idle" | "checking" | "up-to-date" | "available" | "downloading" | "error";

export type SuiteUpdateControls = {
  appName: string;
  currentVersion: string;
  identifier: string;
  platform: string;
  status: SuiteUpdateStatus;
  availableVersion?: string;
  releaseNotes?: string;
  progress?: number;
  downloadedBytes?: number;
  contentLength?: number;
  lastCheckedAt?: string;
  error?: string;
  onCheck: () => void;
  onInstall: () => void;
};

export const SUITE_STYLE_OPTIONS = [
  ["forge-mono-light", "Everend Forge Light"],
  ["forge-mono-dark", "Everend Forge Dark"],
  ["worldnotion-light", "WorldNotion Light"],
  ["worldnotion-dark", "WorldNotion Dark"],
  ["github", "GitHub Light"],
  ["github-dark", "GitHub Dark"],
  ["one-light-pro", "One Light Pro"],
  ["one-dark-pro", "One Dark Pro"],
  ["dracula-light", "Dracula Light"],
  ["dracula", "Dracula"],
  ["light-owl", "Light Owl"],
  ["night-owl", "Night Owl"],
  ["material-lighter", "Material Lighter"],
  ["material-palenight", "Material Palenight"],
] as const;

export type SuiteChrome = {
  /** Optional embedded settings center. Older hosts keep the local dialog. */
  settingsHost?: SettingsHost;
  /** Optional onboarding host; absent in standalone and older Suite builds. */
  learning?: LearningHost;
  /** Optional host for one notification history across the Suite. */
  notifications?: NotificationHost;
  /** Opens the app's existing settings, including the host's Suite sections. */
  registerSettingsOpener?: (open: (section?: "suite") => void) => () => void;
  registerUniverseSwitchGuard?: (guard: () => Promise<boolean>) => () => void;
  active: boolean;
  sharedUniversePath?: string;
  onReady?: () => void;
  onHome?: () => void;
  onReload?: () => void;
  renderAppSwitcher: () => ReactNode;
  suiteSettings?: SuiteSettings;
};
