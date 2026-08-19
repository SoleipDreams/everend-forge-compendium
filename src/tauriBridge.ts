import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { SourceFile } from "./types.js";

export type VaultReadResult = {
  rootPath: string;
  files: Array<SourceFile & { absolutePath: string; modifiedMs?: number }>;
  directories: string[];
  errors: Array<{ relativePath: string; message: string }>;
};

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function openVaultDialog() {
  return invoke<string | null>("open_vault_dialog");
}

export function indexVault(path: string) {
  return invoke<VaultReadResult>("index_vault", { path });
}

export function readFileBase64(vaultPath: string, relativePath: string) {
  return invoke<string>("read_file_base64", { vaultPath, relativePath });
}

export function revealVault(vaultPath: string) {
  return invoke<boolean>("reveal_vault", { vaultPath });
}

export function saveUniverseTextFile(
  universePath: string,
  relativePath: string,
  content: string,
) {
  return invoke<{ ok: boolean; message?: string }>("save_universe_text_file", {
    universePath,
    relativePath,
    content,
  });
}

export function deleteUniverseFile(universePath: string, relativePath: string) {
  return invoke<{ ok: boolean; message?: string }>("delete_universe_file", {
    universePath,
    relativePath,
  });
}

export function openExternal(url: string) {
  if (isTauriRuntime()) return openUrl(url);
  window.open(url, "_blank", "noopener,noreferrer");
  return Promise.resolve();
}

const assetCache = new Map<string, Promise<string>>();

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

/** Resolves a vault-relative asset path to a data URL, with caching. */
export function vaultAssetDataUrl(vaultPath: string, relativePath: string) {
  const key = `${vaultPath}::${relativePath}`;
  let promise = assetCache.get(key);
  if (!promise) {
    const extension = relativePath.split(".").pop()?.toLowerCase() ?? "";
    const mime = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
    promise = readFileBase64(vaultPath, relativePath).then(
      (base64) => `data:${mime};base64,${base64}`,
    );
    assetCache.set(key, promise);
    promise.catch(() => assetCache.delete(key));
  }
  return promise;
}
