import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { zipSync } from "fflate";
import { starterConfig } from "../src/lib/config.js";
import { exportMarkdown } from "../src/lib/node/markdown-export.js";
import {
  configPath,
  applySiteBasePath,
  copyReferencedAssets,
  createSiteDataFile,
  loadSiteWithOptions,
  writePublicationManifest,
} from "../src/lib/node/site.js";
import type { PublicationMode } from "../src/types.js";

const [command, vaultArgument, ...arguments_] = process.argv.slice(2);
const vault = vaultArgument ? path.resolve(vaultArgument) : undefined;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function flagValue(name: string) {
  const inline = arguments_.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
}

const outputValue = flagValue("--out");
const output = outputValue ? path.resolve(outputValue) : undefined;
const profileId = flagValue("--profile");
const requestedMode = flagValue("--mode") as PublicationMode | undefined;

function usage() {
  console.error(
    "Usage: everend-compendium <build|dev|preview|package|init|markdown> <vault> [--profile=<id>] [--mode=preview|all] [--out=<path>]",
  );
}

function runAstro(args: string[], source: string, basePath?: string) {
  const astro = path.join(root, "node_modules", "astro", "astro.js");
  const child = childProcess.spawnSync(process.execPath, [astro, ...args], {
    cwd: root,
    env: {
      ...process.env,
      COMPENDIUM_SOURCE: source,
      COMPENDIUM_BASE_PATH: basePath ?? "/",
    },
    stdio: "inherit",
  });
  return child.status ?? 1;
}

function removeDirectory(directory: string) {
  fs.rmSync(directory, { recursive: true, force: true });
}

function collectFiles(directory: string, current = directory) {
  const files: Record<string, Uint8Array> = {};
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, collectFiles(directory, absolute));
    } else if (entry.isFile()) {
      const relative = path
        .relative(directory, absolute)
        .replaceAll(path.sep, "/");
      files[relative] = new Uint8Array(fs.readFileSync(absolute));
    }
  }
  return files;
}

function createZip(directory: string, destination: string) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, zipSync(collectFiles(directory), { level: 6 }));
}

function basePathFromUrl(value: string | undefined) {
  if (!value) return "/";
  try {
    return new URL(value).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.startsWith("/") ? value.replace(/\/+$/, "") || "/" : "/";
  }
}

if (
  !command ||
  !vault ||
  !["build", "dev", "preview", "package", "init", "markdown"].includes(
    command,
  ) ||
  (requestedMode && !["all", "preview"].includes(requestedMode))
) {
  usage();
  process.exitCode = 1;
} else if (command === "init") {
  const destination = configPath(vault);
  if (fs.existsSync(destination))
    throw new Error(`${destination} already exists.`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, starterConfig);
  console.log(`Created ${destination}`);
} else {
  const mode: PublicationMode = requestedMode ?? "preview";
  if (
    (command === "build" || command === "preview" || command === "package") &&
    mode === "all"
  ) {
    throw new Error(
      `${command} only exports Preview; use dev --mode=all for local inspection.`,
    );
  }

  const site = applySiteBasePath(
    loadSiteWithOptions(vault, { profileId, mode }),
  );
  if (command === "markdown") {
    exportMarkdown(site, output ?? path.join(vault, "compendium-markdown"));
  } else if (command === "dev" || command === "preview") {
    const temp = createSiteDataFile(site);
    try {
      const status = runAstro(
        ["dev", "--host"],
        temp.file,
        basePathFromUrl(site.config.site?.baseUrl),
      );
      process.exitCode = status || undefined;
    } finally {
      temp.dispose();
    }
  } else if (command === "build") {
    const out = output ?? path.join(root, "dist");
    const temp = createSiteDataFile(site);
    try {
      const status = runAstro(
        ["build", "--outDir", out],
        temp.file,
        basePathFromUrl(site.config.site?.baseUrl),
      );
      if (status !== 0) {
        process.exitCode = status;
      } else {
        copyReferencedAssets(site, out);
        writePublicationManifest(site, out);
        console.log(
          `Built ${site.entities.length} entries and ${site.stories.length} stories to ${out}`,
        );
      }
    } finally {
      temp.dispose();
    }
  } else {
    const out = output ?? path.join(root, "compendium-export.zip");
    const temporaryOutput = fs.mkdtempSync(
      path.join(os.tmpdir(), "everend-compendium-package-"),
    );
    const temp = createSiteDataFile(site);
    try {
      const status = runAstro(
        ["build", "--outDir", temporaryOutput],
        temp.file,
        basePathFromUrl(site.config.site?.baseUrl),
      );
      if (status !== 0) {
        process.exitCode = status;
      } else {
        copyReferencedAssets(site, temporaryOutput);
        writePublicationManifest(site, temporaryOutput);
        createZip(temporaryOutput, out);
        console.log(
          `Packaged ${site.entities.length} entries and ${site.stories.length} stories to ${out}`,
        );
      }
    } finally {
      temp.dispose();
      removeDirectory(temporaryOutput);
    }
  }
}
