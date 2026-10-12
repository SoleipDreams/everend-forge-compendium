import { THEMES } from "../themes";
import { useEffect, useRef, type ReactNode } from "react";
import { SettingsFrame } from "../SettingsFrame";
import type { SettingsHost } from "../settingsIntegration";
import { compendiumSettingsPages, compendiumSettingsPage } from "../settingsCatalog";
import type { SuiteSettings } from "../suiteChrome";
import { compendiumSettingsCopy, resolveInterfaceLocale, type LocalePreference } from "../i18n";
export type SettingsSection = "general" | "appearance" | "universe" | "about" | "suite" | "update";
const legacyHostPages = [...compendiumSettingsPages, ...["language","update"].map(id => ({ id: "suite."+id, owner: "suite", group: {en:"General",es:"General"}, title: id === "language" ? {en:"Suite preferences",es:"Preferencias de la Suite"} : {en:"Updates",es:"Actualizaciones"}, controls: [] }))];
const integratedPages = compendiumSettingsPages.filter(page => page.id === "compendium.appearance");
export function SettingsDialog({ visible = true, active = true, section, onSectionChange, onClose, appearance, generalAppearance, universe, onOpenDocs, suiteSettings, settingsHost, localePreference, onLocalePreferenceChange, publication }: {
  visible?: boolean; active?: boolean; section: SettingsSection; onSectionChange: (section: SettingsSection) => void; onClose: () => void;
  appearance: ReactNode; generalAppearance?: ReactNode; universe?: ReactNode; publication?: () => void; onOpenDocs: () => void;
  suiteSettings?: SuiteSettings; settingsHost?: SettingsHost; localePreference: LocalePreference; onLocalePreferenceChange: (preference: LocalePreference) => void;
}) {
  const locale = resolveInterfaceLocale(localePreference), es = locale === "es";
  const page = settingsHost?.page ?? compendiumSettingsPage(section), selected = page === "suite.language" ? "suite" : page.split(".").at(-1);
  const copy = compendiumSettingsCopy(locale);
  useEffect(() => { if (visible && settingsHost) settingsHost.open(compendiumSettingsPage(section)); }, [visible, section, settingsHost?.open]);
  const requestExit = useRef<((after?: () => void) => void) | null>(null);
  const exit = (after: () => void) => settingsHost?.requestClose ? settingsHost.requestClose(after) : requestExit.current?.(after);
  const wasHostVisible = useRef(false);
  useEffect(() => { if (wasHostVisible.current && !settingsHost?.visible) onClose(); wasHostVisible.current = Boolean(settingsHost?.visible); }, [settingsHost?.visible]);
  return <SettingsFrame title={es ? "Ajustes de Compendium" : "Compendium settings"} locale={locale} pages={settingsHost ? integratedPages : suiteSettings ? legacyHostPages : compendiumSettingsPages} page={page} onPage={id => onSectionChange((id === "suite.language" ? "suite" : id.split(".").at(-1)) as SettingsSection)} visible={visible} interactive={active} onClose={onClose} host={settingsHost} hasUniverse={Boolean(universe)} onHelp={onOpenDocs} requestExitRef={requestExit} contentClassName="compendium-settings-content">
    {selected === "general" && <div className="settings-control-panel"><label><span>{es ? "Idioma de la interfaz" : "Interface language"}</span><select value={localePreference} onChange={event => onLocalePreferenceChange(event.target.value as LocalePreference)}><option value="system">{es ? "Sistema" : "System"}</option><option value="en">English</option><option value="es">Español</option></select></label>{generalAppearance}</div>}
    {selected === "appearance" && <div className="settings-control-panel">{appearance}{publication && <button type="button" onClick={() => exit(publication)}>{es ? "Abrir Publicación" : "Open publication workspace"}</button>}</div>}
    {!settingsHost && universe && <div hidden={selected !== "universe"}>{universe}</div>}
    {selected === "about" && <div className="about-settings"><p>Everend Compendium</p><p>{es ? "Edición de lectura y publicación de tu universo." : "A reading and publication edition of your universe."}</p><dl><dt>{copy.version}</dt><dd>{suiteSettings?.update.currentVersion ?? "0.2.4"}</dd><dt>{copy.canonSafety}</dt><dd>{copy.canonValue}</dd></dl><button type="button" onClick={() => exit(onOpenDocs)}>{es ? "Documentación" : "Documentation"}</button></div>}
    {!settingsHost && selected === "suite" && suiteSettings && <div className="settings-control-panel"><label><span>{es ? "Idioma de la interfaz" : "Interface language"}</span><select value={suiteSettings.localePreference} onChange={event => suiteSettings.onLocalePreferenceChange(event.target.value as LocalePreference)}><option value="system">{es ? "Sistema" : "System"}</option><option value="en">English</option><option value="es">Español</option></select></label>{generalAppearance ?? <label><span>{es ? "Tema" : "Theme"}</span><select value={suiteSettings.style} onChange={event => suiteSettings.onStyleChange(event.target.value)}>{THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.label}</option>)}</select></label>}<label><span>{es ? "Fuente de interfaz" : "Interface typeface"}</span><select value={suiteSettings.primaryFont} onChange={event => suiteSettings.onPrimaryFontChange(event.target.value)}><option value="sans">Sans serif</option><option value="serif">Serif</option><option value="humanist">Humanist</option></select></label></div>}
    {!settingsHost && selected === "update" && suiteSettings && <div><p>{suiteSettings.update.currentVersion}</p><p role="status">{suiteSettings.update.error ?? suiteSettings.update.status}</p><button type="button" disabled={["checking","downloading"].includes(suiteSettings.update.status)} onClick={suiteSettings.update.onCheck}>{es ? "Buscar actualizaciones" : "Check for updates"}</button>{suiteSettings.update.status === "available" && <button type="button" onClick={suiteSettings.update.onInstall}>{es ? "Instalar y reiniciar" : "Install and restart"}</button>}</div>}
  </SettingsFrame>;
}
