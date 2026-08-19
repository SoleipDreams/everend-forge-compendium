import { defineConfig } from "astro/config";

export default defineConfig({
  srcDir: "./site",
  base: process.env.COMPENDIUM_BASE_PATH && process.env.COMPENDIUM_BASE_PATH !== "/"
    ? process.env.COMPENDIUM_BASE_PATH
    : undefined,
  output: "static",
  build: { format: "directory" },
});
