// @vitest-environment jsdom
import { act, type CSSProperties } from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { GraphView } from "../src/components/GraphView";
import { loadSettings, saveSettings } from "../src/settings";
import {
  THEMES,
  isDarkTheme,
  normalizeThemeId,
  toggledThemeMode,
} from "../src/themes";
import { assembleIndexedUniverse } from "../src/lib/assemble";
import { sanitizeDom } from "../src/lib/sanitize-dom";
import {
  loadPublicationProfiles,
  projectIndexedUniverse,
} from "../src/lib/publications";
import type { SuiteSettings } from "../src/suiteChrome";

const simulation = vi.hoisted(() => {
  const value = {
    force: vi.fn(),
    on: vi.fn(),
    stop: vi.fn(),
  };
  value.force.mockReturnValue(value);
  value.on.mockReturnValue(value);
  return value;
});
vi.mock("d3-force", () => {
  const force = () => {
    const value = {
      id: vi.fn(),
      distance: vi.fn(),
      strength: vi.fn(),
      radius: vi.fn(),
    };
    Object.values(value).forEach((method) => method.mockReturnValue(value));
    return value;
  };
  return {
    forceSimulation: () => simulation,
    forceCollide: force,
    forceLink: force,
    forceManyBody: force,
    forceX: force,
    forceY: force,
  };
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  simulation.force.mockReturnValue(simulation);
  simulation.on.mockReturnValue(simulation);
  simulation.stop.mockClear();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete document.documentElement.dataset.theme;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Everend Forge integration", () => {
  it("changes only colors, preserving typography, geometry and motion", () => {
    const css = readFileSync(
      resolve(process.cwd(), "src/forgeMono.css"),
      "utf8",
    );
    const colorProperties = new Set([
      "color-scheme",
      "color",
      "background",
      "background-color",
      "border-color",
      "outline-color",
      "accent-color",
      "caret-color",
      "stroke",
      "fill",
    ]);
    for (const [, property, value] of css.matchAll(
      /^\s*([\w-]+):\s*([^;{}]+);/gm,
    )) {
      if (property.startsWith("--")) {
        expect(value.trim(), property).toMatch(/^(?:#|var\(|color-mix\()/);
      } else if (property !== "display") {
        expect(colorProperties.has(property), property).toBe(true);
      }
    }
    // The only visibility override chooses the matching logo color variant.
    expect(css.match(/display:/g)).toHaveLength(2);
    expect(css).not.toContain("@import");
  });

  it.each(["light", "dark"])(
    "keeps text, status cues and primary actions readable in %s mode",
    (mode) => {
      const css = readFileSync(
        resolve(process.cwd(), "src/forgeMono.css"),
        "utf8",
      );
      const block = css.match(
        new RegExp(
          `:root\\[data-theme="forge-mono-${mode}"\\] .forge-compendium \\{([^}]+)`,
        ),
      )![1];
      const palette = Object.fromEntries(
        [...block.matchAll(/--(ef-[\w-]+): (#[\da-f]+);/g)].map((match) => [
          match[1],
          match[2],
        ]),
      );
      const luminance = (hex: string) => {
        const [red, green, blue] = hex
          .slice(1)
          .match(/../g)!
          .map((value) => parseInt(value, 16) / 255)
          .map((value) =>
            value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
          );
        return red * 0.2126 + green * 0.7152 + blue * 0.0722;
      };
      const contrast = (foreground: string, background: string) => {
        const a = luminance(foreground);
        const b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      };
      for (const token of [
        "text",
        "muted",
        "faint",
        "blue",
        "steel",
        "success",
        "danger",
        "accent",
      ]) {
        expect(
          contrast(palette[`ef-${token}`], palette["ef-panel"]),
          `${token} text on panel`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      expect(
        contrast(palette["ef-accent-contrast"], palette["ef-accent"]),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        new Set([
          palette["ef-success"],
          palette["ef-blue"],
          palette["ef-danger"],
          palette["ef-accent"],
        ]).size,
      ).toBe(4);
    },
  );

  it.each(["forge-mono-light", "forge-mono-dark"] as const)(
    "retains %s after saving settings without replacing the reader typeface",
    (theme) => {
      saveSettings({
        ...loadSettings(),
        theme,
        primaryFont: "humanist",
        recentUniverses: ["test-vault"],
      });
      expect(loadSettings()).toMatchObject({
        theme,
        primaryFont: "humanist",
        recentUniverses: ["test-vault"],
      });
      expect(normalizeThemeId(theme)).toBe(theme);
    },
  );

  it("toggles within the Forge family and keeps legacy theme migrations", () => {
    expect(toggledThemeMode("forge-mono-light")).toBe("forge-mono-dark");
    expect(toggledThemeMode("forge-mono-dark")).toBe("forge-mono-light");
    expect(isDarkTheme("forge-mono-light")).toBe(false);
    expect(isDarkTheme("forge-mono-dark")).toBe(true);
    expect(normalizeThemeId("compendium-light")).toBe("worldnotion-light");
    expect(normalizeThemeId("compendium-dark")).toBe("worldnotion-dark");
    expect(THEMES.find((theme) => theme.id === "night-owl")?.mode).toBe("dark");
  });

  it("offers and dispatches both Forge styles from embedded Suite settings", async () => {
    const onStyleChange = vi.fn();
    const settings = {
      localePreference: "en",
      locale: "en",
      style: "forge-mono-dark",
      primaryFont: "humanist",
      onStyleChange,
      onLocalePreferenceChange: vi.fn(),
      onPrimaryFontChange: vi.fn(),
      onToggleStyleMode: vi.fn(),
    } as unknown as SuiteSettings;
    await act(async () =>
      root.render(
        <SettingsDialog
          section="suite"
          onSectionChange={vi.fn()}
          onClose={vi.fn()}
          onOpenDocs={vi.fn()}
          appearance={null}
          suiteSettings={settings}
          localePreference="en"
          onLocalePreferenceChange={vi.fn()}
        />,
      ),
    );
    const style = Array.from(container.querySelectorAll("select")).find(
      (select) => select.value === "forge-mono-dark",
    )!;
    expect(style).toBeDefined();
    expect(
      Array.from(style.options)
        .filter((option) => option.value.startsWith("forge-mono-"))
        .map((option) => option.text),
    ).toEqual(["Everend Forge Light", "Everend Forge Dark"]);
    await act(async () => {
      style.value = "forge-mono-light";
      style.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onStyleChange).toHaveBeenCalledWith("forge-mono-light");
  });

  it("repaints the relationship graph from its app palette while preserving zoom", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("devicePixelRatio", 1);
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      setLineDash: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const indexed = assembleIndexedUniverse(
      "test-vault",
      [
        {
          relativePath: "Characters/Aster.md",
          content:
            "---\nid: character:aster\ntype: character\nname: Aster\nstatus: canon\n---\nBiography.\n",
        },
      ],
      sanitizeDom,
    );
    const profile = loadPublicationProfiles([], indexed.config).active;
    const site = projectIndexedUniverse(
      indexed,
      "preview",
      profile,
      sanitizeDom,
    );
    document.documentElement.dataset.theme = "forge-mono-light";
    await act(async () =>
      root.render(
        <div
          className="forge-compendium"
          style={
            {
              "--cp-bg": "#f5ecd9",
              "--cp-accent": "#87531e",
            } as CSSProperties
          }
        >
          <GraphView site={site} navigate={vi.fn()} />
        </div>,
      ),
    );
    expect(context.fillStyle).toBe("#f5ecd9");
    const canvas = container.querySelector("canvas")!;
    await act(async () =>
      canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 })),
    );
    expect(context.scale).toHaveBeenLastCalledWith(1.12, 1.12);
    await act(async () => {
      container
        .querySelector<HTMLElement>(".forge-compendium")!
        .style.setProperty("--cp-bg", "#0a0b10");
      document.documentElement.dataset.theme = "forge-mono-dark";
      await Promise.resolve();
    });
    expect(context.fillStyle).toBe("#0a0b10");
    expect(context.scale).toHaveBeenLastCalledWith(1.12, 1.12);
    expect(simulation.stop).not.toHaveBeenCalled();
  });
});
