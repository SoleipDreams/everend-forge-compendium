use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::menu::{
    Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultFile {
    relative_path: String,
    absolute_path: String,
    content: String,
    binary: bool,
    modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultReadError {
    relative_path: String,
    message: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultReadResult {
    root_path: String,
    files: Vec<VaultFile>,
    directories: Vec<String>,
    errors: Vec<VaultReadError>,
}

fn menu_item(
    app: &tauri::AppHandle,
    id: &str,
    label: &str,
    accelerator: Option<&str>,
) -> tauri::Result<MenuItem<tauri::Wry>> {
    MenuItem::with_id(app, id, label, true, accelerator)
}

fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let file_menu = Submenu::with_items(
        app,
        "File",
        true,
        &[
            &menu_item(
                app,
                "cp:file:open-universe",
                "Open Universe...",
                Some("CmdOrCtrl+O"),
            )?,
            &menu_item(app, "cp:file:reveal-universe", "Reveal Universe", None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[
            &menu_item(
                app,
                "cp:view:toggle-light-dark",
                "Toggle Light/Dark",
                Some("CmdOrCtrl+Shift+L"),
            )?,
            &menu_item(app, "cp:view:mode-web", "Web Mode", Some("CmdOrCtrl+1"))?,
            &menu_item(app, "cp:view:mode-book", "Book Mode", Some("CmdOrCtrl+2"))?,
            &PredefinedMenuItem::separator(app)?,
            &menu_item(app, "cp:view:reload", "Reload", Some("CmdOrCtrl+R"))?,
        ],
    )?;

    let window_menu = Submenu::with_id_and_items(
        app,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    let help_menu = Submenu::with_id_and_items(
        app,
        HELP_SUBMENU_ID,
        "Help",
        true,
        &[
            &menu_item(app, "cp:help:about", "About Everend Compendium", None)?,
            &menu_item(app, "cp:help:docs", "Documentation", None)?,
        ],
    )?;

    Menu::with_items(app, &[&file_menu, &view_menu, &window_menu, &help_menu])
}

fn modified_ms(path: &Path) -> Option<u128> {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
}

fn should_read_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("yaml") | Some("yml") | Some("json")
    )
}

fn is_image_file(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "avif")
    )
}

fn allowed_dot_dir(name: &str) -> bool {
    name == ".everend"
        || name == ".pathbranching"
        || name == ".compendium"
        || name == ".worldnotion"
}

fn walk_vault(
    root: &Path,
    current: &Path,
    files: &mut Vec<VaultFile>,
    directories: &mut Vec<String>,
    errors: &mut Vec<VaultReadError>,
) {
    let entries = match fs::read_dir(current) {
        Ok(entries) => entries,
        Err(error) => {
            let relative_path = current
                .strip_prefix(root)
                .unwrap_or(current)
                .to_string_lossy()
                .replace('\\', "/");
            errors.push(VaultReadError {
                relative_path,
                message: error.to_string(),
            });
            return;
        }
    };

    for entry in entries {
        match entry {
            Ok(entry) => {
                let path = entry.path();
                let file_name = entry.file_name();
                let name = file_name.to_string_lossy();
                if name.starts_with('.') && !allowed_dot_dir(&name) {
                    continue;
                }

                if path.is_dir() {
                    let relative_path = path
                        .strip_prefix(root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");
                    if !relative_path.is_empty() {
                        directories.push(relative_path);
                    }
                    walk_vault(root, &path, files, directories, errors);
                } else if should_read_file(&path) || is_image_file(&path) {
                    let relative_path = path
                        .strip_prefix(root)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");

                    let binary = is_image_file(&path);
                    let content = if binary {
                        Ok(String::new())
                    } else {
                        fs::read_to_string(&path)
                    };
                    match content {
                        Ok(content) => files.push(VaultFile {
                            relative_path,
                            absolute_path: path.to_string_lossy().to_string(),
                            content,
                            binary,
                            modified_ms: modified_ms(&path),
                        }),
                        Err(error) => errors.push(VaultReadError {
                            relative_path,
                            message: error.to_string(),
                        }),
                    }
                }
            }
            Err(error) => errors.push(VaultReadError {
                relative_path: current
                    .strip_prefix(root)
                    .unwrap_or(current)
                    .to_string_lossy()
                    .replace('\\', "/"),
                message: error.to_string(),
            }),
        }
    }
}

fn read_vault(root: PathBuf) -> Result<VaultReadResult, String> {
    if !root.exists() {
        return Err(format!("Vault path does not exist: {}", root.display()));
    }

    if !root.is_dir() {
        return Err(format!("Vault path is not a directory: {}", root.display()));
    }

    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut errors = Vec::new();
    walk_vault(&root, &root, &mut files, &mut directories, &mut errors);
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    directories.sort();

    Ok(VaultReadResult {
        root_path: root.to_string_lossy().to_string(),
        files,
        directories,
        errors,
    })
}

fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let mut normalized = PathBuf::new();
    for segment in relative_path.replace('\\', "/").split('/') {
        if segment.is_empty() || segment == "." {
            continue;
        }
        if segment == ".." {
            return Err("Path may not traverse outside the vault.".to_string());
        }
        normalized.push(segment);
    }
    if normalized.as_os_str().is_empty() {
        return Err("Path may not be empty.".to_string());
    }
    Ok(normalized)
}

fn resolve_vault_path(vault_path: &str, relative_path: &str) -> Result<(PathBuf, PathBuf), String> {
    let root = PathBuf::from(vault_path);
    if !root.exists() || !root.is_dir() {
        return Err("Vault path does not exist.".to_string());
    }
    let relative = normalize_relative_path(relative_path)?;
    Ok((root.clone(), root.join(relative)))
}

fn open_in_system(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(path).spawn();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(path).spawn();
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let result = Command::new("xdg-open").arg(path).spawn();
    result.map(|_| ()).map_err(|error| error.to_string())
}

#[tauri::command]
async fn open_vault_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    Ok(app
        .dialog()
        .file()
        .blocking_pick_folder()
        .map(|path| path.to_string()))
}

#[tauri::command]
fn index_vault(path: String) -> Result<VaultReadResult, String> {
    read_vault(PathBuf::from(path))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

/// Maximum size for binary reads exposed to the webview (image previews).
const MAX_BINARY_READ_BYTES: u64 = 10 * 1024 * 1024;

#[tauri::command]
fn read_file_base64(vault_path: String, relative_path: String) -> Result<String, String> {
    let (_root, path) = resolve_vault_path(&vault_path, &relative_path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if !metadata.is_file() {
        return Err("Path is not a file.".to_string());
    }
    if metadata.len() > MAX_BINARY_READ_BYTES {
        return Err("File is too large to preview (limit 10 MB).".to_string());
    }
    let bytes = fs::read(&path).map_err(|error| error.to_string())?;
    use base64::Engine as _;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
fn reveal_vault(vault_path: String) -> Result<bool, String> {
    let path = PathBuf::from(vault_path);
    if !path.exists() || !path.is_dir() {
        return Err("Vault path does not exist.".to_string());
    }
    open_in_system(&path)?;
    Ok(true)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteResult {
    ok: bool,
    message: Option<String>,
}

#[tauri::command]
fn save_universe_text_file(
    universe_path: String,
    relative_path: String,
    content: String,
) -> Result<WriteResult, String> {
    let (_root, path) = resolve_vault_path(&universe_path, &relative_path)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())?;
    Ok(WriteResult {
        ok: true,
        message: None,
    })
}

#[tauri::command]
fn delete_universe_file(
    universe_path: String,
    relative_path: String,
) -> Result<WriteResult, String> {
    let (_root, path) = resolve_vault_path(&universe_path, &relative_path)?;
    if path.exists() {
        if !path.is_file() {
            return Err("Path is not a file.".to_string());
        }
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(WriteResult {
        ok: true,
        message: None,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(build_app_menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id.starts_with("cp:") {
                let _ = app.emit("compendium-menu", id);
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            open_vault_dialog,
            index_vault,
            path_exists,
            read_file_base64,
            reveal_vault,
            save_universe_text_file,
            delete_universe_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::normalize_relative_path;

    #[test]
    fn rejects_traversal() {
        assert!(normalize_relative_path("../outside").is_err());
        assert!(normalize_relative_path("a/../../b").is_err());
    }

    #[test]
    fn normalizes_separators() {
        let normalized = normalize_relative_path("Maps\\region.png").unwrap();
        assert_eq!(normalized.to_string_lossy().replace('\\', "/"), "Maps/region.png");
    }
}
