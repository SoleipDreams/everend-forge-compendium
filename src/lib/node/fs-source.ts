import fs from "node:fs";
import path from "node:path";
import type { SourceFile } from "../../types.js";

const TEXT_EXTENSIONS = new Set([".md", ".yaml", ".yml", ".json"]);
const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".avif",
]);

/** Dot-directories the walk is allowed to descend into. */
const ALLOWED_DOT_DIRS = new Set([
  ".everend",
  ".pathbranching",
  ".compendium",
  ".worldnotion",
]);

function walk(root: string, current: string, files: SourceFile[]) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && !ALLOWED_DOT_DIRS.has(entry.name))
      continue;
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      walk(root, fullPath, files);
    } else if (
      entry.isFile() &&
      TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push({
        relativePath: path.relative(root, fullPath).replaceAll(path.sep, "/"),
        content: fs.readFileSync(fullPath, "utf8"),
      });
    } else if (
      entry.isFile() &&
      IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
    ) {
      files.push({
        relativePath: path.relative(root, fullPath).replaceAll(path.sep, "/"),
        content: "",
        binary: true,
      });
    }
  }
}

/**
 * Reads every projectable vault file into memory. Mirrors the walk the
 * desktop app's Rust `index_vault` command performs.
 */
export function walkVaultFiles(vaultPath: string): SourceFile[] {
  const files: SourceFile[] = [];
  walk(vaultPath, vaultPath, files);
  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  return files;
}
