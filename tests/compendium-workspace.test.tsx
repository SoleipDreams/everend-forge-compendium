// @vitest-environment jsdom
import { formatCompendiumDiagnostic } from "../src/components/compendiumPresentation";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompendiumWorkspace } from "../src/components/CompendiumWorkspace";
import {
  CompendiumLocale,
  CompendiumMenu,
} from "../src/components/compendiumPresentation";
import { CoverPage } from "../src/components/CoverPage";
import { PublicationManager } from "../src/components/PublicationManager";
import { SearchBox } from "../src/components/SearchBox";
import { assembleIndexedUniverse } from "../src/lib/assemble";
import {
  createDefaultPublicationProfile,
  projectIndexedUniverse,
} from "../src/lib/publications";
import { sanitizeDom } from "../src/lib/sanitize-dom";
import { loadSettings, SETTINGS_KEY } from "../src/settings";
import type { PublicationProfile } from "../src/types";

const indexed = assembleIndexedUniverse(
  "test-vault",
  Array.from({ length: 12 }, (_, i) => ({
    relativePath: `Characters/Aster${i}.md`,
    content: `---\nid: character:aster${i}\nname: Aster ${i}\ntype: character\nstatus: canon\ndate: '120${i}'\n---\nBiography.\n`,
  })),
  sanitizeDom,
);
const site = projectIndexedUniverse(
  indexed,
  "all",
  createDefaultPublicationProfile(indexed.config),
  sanitizeDom,
);
let container: HTMLDivElement;
let root: Root;
let measuredWidth = 1440;
let observed: ResizeObserverCallback[] = [];
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  sessionStorage.clear();
  observed = [];
  measuredWidth = 1440;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      width: measuredWidth,
      height: 720,
      left: 0,
      top: 0,
      right: measuredWidth,
      bottom: 720,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observed.push(callback);
      }
      observe() {
        observed.at(-1)?.([], this as unknown as ResizeObserver);
      }
      disconnect() {}
      unobserve() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = async (view: ReactNode) => {
  await act(async () => root.render(view));
};
const button = (text: string, scope: ParentNode = container) => {
  const element = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) =>
      b.textContent?.trim() === text || b.getAttribute("aria-label") === text,
  );
  if (!element) throw new Error(`Missing button ${text}`);
  return element;
};
const click = async (text: string, scope?: ParentNode) => {
  await act(async () => button(text, scope).click());
};
const change = async (input: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};
const key = async (target: Element, value: string) => {
  await act(async () =>
    target.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: value,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
};

function Reading() {
  const [route, setRoute] = useState("/");
  const [publication, setPublication] = useState(
    () => loadSettings().explorer?.section === "publication",
  );
  return (
    <CompendiumLocale.Provider value="en">
      <CompendiumWorkspace
        site={site}
        route={route}
        publication={publication}
        onPublication={setPublication}
        onPreferencesChange={(prefs) =>
          localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify({ ...loadSettings(), explorer: prefs }),
          )
        }
        navigate={setRoute}
      >
        <div data-route={route} />
        <CoverPage site={site} navigate={setRoute} />
      </CompendiumWorkspace>
    </CompendiumLocale.Provider>
  );
}

describe("Compendium reading explorer", () => {
  it("restores publication and persists the section after returning to reading", async () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        explorer: {
          section: "publication",
          open: false,
          width: 320,
          collapsed: [],
        },
      }),
    );
    await render(<Reading />);
    expect(button("Publication").getAttribute("aria-pressed")).toBe("true");
    expect(loadSettings().explorer?.width).toBe(320);
    await click("Index");
    expect(loadSettings().explorer?.section).toBe("index");
    expect(loadSettings().explorer?.open).toBe(true);
  });
  it("migrates legacy preferences without changing reading choices and sanitizes new optional fields", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        theme: "worldnotion-dark",
        primaryFont: "sans",
        recentUniverses: ["vault"],
      }),
    );
    expect(loadSettings().explorer).toEqual({
      section: "index",
      open: true,
      width: 280,
      collapsed: [],
    });
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        explorer: {
          section: "invalid",
          width: 999,
          collapsed: ["type:character", 42],
        },
      }),
    );
    expect(loadSettings().explorer).toEqual({
      section: "index",
      open: true,
      width: 420,
      collapsed: ["type:character"],
    });
  });
  it("categories open the correct index group without navigating to the first entity; graph preserves ordinary opening state", async () => {
    await render(<Reading />);
    await click("⌄character12");
    await click("Cover");
    await click("character12");
    expect(
      container.querySelector("[data-route]")?.getAttribute("data-route"),
    ).toBe("/");
    expect(button("⌄character12").getAttribute("aria-expanded")).toBe("true");
    await click("Views");
    await click("Graph");
    expect(
      container.querySelector(".cp-explorer-panel")?.hasAttribute("hidden"),
    ).toBe(true);
    await click("Cover");
    expect(
      container.querySelector(".cp-explorer-panel")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(loadSettings().explorer?.open).toBe(true);
  });
  it("measures the app container, overlays at 900px, preserves resize and collapse preferences and reveals a selected hidden group", async () => {
    await render(<Reading />);
    measuredWidth = 900;
    await act(async () =>
      observed.forEach((cb) => cb([], {} as ResizeObserver)),
    );
    expect(
      container.querySelector(".cp-workspace")?.classList.contains("overlay"),
    ).toBe(true);
    await key(button("Resize explorer"), "ArrowRight");
    expect(loadSettings().explorer?.width).toBe(300);
    await click("Collapse explorer");
    expect(
      container.querySelector(".cp-explorer-panel")?.hasAttribute("hidden"),
    ).toBe(true);
    await click("Index");
    await click("Aster 0");
    expect(
      container.querySelector(".cp-explorer-panel")?.hasAttribute("hidden"),
    ).toBe(true);
    await click("Index");
    expect(button("Aster 0").getAttribute("aria-current")).toBe("page");
    expect(button("Resize explorer")).not.toBeNull();
  });
  it("keeps search scope/limit, selects with arrows/Enter and dismisses with Escape", async () => {
    const navigate = vi.fn();
    await render(<SearchBox site={site} navigate={navigate} />);
    const input = container.querySelector("input")!;
    await change(input, "Aster");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(8);
    await key(input, "ArrowDown");
    expect(
      container.querySelector('[aria-selected="true"]')?.textContent,
    ).toContain("Aster 0");
    await key(input, "ArrowDown");
    await key(input, "Enter");
    expect(navigate).toHaveBeenLastCalledWith(site.entities[1].route);
    await change(input, "missing");
    expect(container.textContent).toContain("No matching entries.");
    await key(input, "Escape");
    expect(input.value).toBe("");
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
  it("dismisses View with Escape and restores the summary focus", async () => {
    await render(
      <CompendiumMenu label="View">
        <button>Web</button>
      </CompendiumMenu>,
    );
    const details = container.querySelector("details")!;
    details.open = true;
    button("Web").focus();
    await key(button("Web"), "Escape");
    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(details.querySelector("summary"));
  });
});

const base = createDefaultPublicationProfile(indexed.config);
const second: PublicationProfile = {
  ...structuredClone(base),
  id: "second",
  name: "Second",
};
const guards = new Set<() => Promise<boolean>>();
const register = (guard: () => Promise<boolean>) => {
  guards.add(guard);
  return () => {
    guards.delete(guard);
  };
};
function Publishing({ fail = false }: { fail?: boolean }) {
  const [profiles, setProfiles] = useState([base, second]);
  const [active, setActive] = useState(base.id);
  const [visible, setVisible] = useState(true);
  return (
    <CompendiumLocale.Provider value="en">
      <button onClick={() => setVisible(!visible)}>Reading</button>
      <div hidden={!visible}>
        <PublicationManager
          indexed={indexed}
          profiles={profiles}
          activeProfileId={active}
          onSave={async (profile) => {
            if (fail) throw new Error("Disk unavailable");
            setProfiles((current) => [
              ...current.filter((p) => p.id !== profile.id),
              profile,
            ]);
          }}
          onActivate={async (profile) => setActive(profile.id)}
          onDelete={async () => {}}
          onPreview={() => setVisible(false)}
          registerUniverseSwitchGuard={register}
        />
      </div>
    </CompendiumLocale.Provider>
  );
}
const profileName = () =>
  container.querySelector<HTMLInputElement>(
    ".publication-manager-fields > label input",
  )!;
const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]')!;
describe("Publication draft transitions", () => {
  it("retains draft and guard while reading; cancel/Escape keep it and discard explicitly changes profile", async () => {
    await render(<Publishing />);
    await change(profileName(), "Pending draft");
    expect(await [...guards][0]()).toBe(false);
    await click("Reading");
    expect(profileName().value).toBe("Pending draft");
    expect(await [...guards][0]()).toBe(false);
    await click("Reading");
    await click("SecondSaved profile");
    expect(dialog()).not.toBeNull();
    await click("Cancel", dialog());
    expect(profileName().value).toBe("Pending draft");
    await click("New profile");
    await key(dialog(), "Escape");
    expect(dialog()).toBeNull();
    await click("SecondSaved profile");
    await click("Discard changes", dialog());
    expect(profileName().value).toBe("Second");
    expect(await [...guards][0]()).toBe(true);
  });
  it("saves before creating another profile, preserves source selections and activates using the primary action", async () => {
    await render(<Publishing />);
    await change(profileName(), "Saved name");
    await click("New profile");
    await click("Save", dialog());
    expect(dialog()).toBeNull();
    expect(profileName().value).toBe("New publication");
    await click("Save and activate");
    expect(await [...guards][0]()).toBe(true);
    expect(container.textContent).toContain("New publicationActive");
    expect(
      container.querySelectorAll(".publication-selection-checks input"),
    ).toHaveLength(24);
  });
  it("save failure keeps the prompt and draft, blocks universe changes and returns focus after cancel", async () => {
    await render(<Publishing fail />);
    await change(profileName(), "Retain me");
    const newProfile = button("New profile");
    newProfile.focus();
    await click("New profile");
    await click("Save", dialog());
    expect(dialog().textContent).toContain("Disk unavailable");
    expect(profileName().value).toBe("Retain me");
    expect(await [...guards][0]()).toBe(false);
    await click("Cancel", dialog());
    expect(document.activeElement).toBe(newProfile);
    expect(profileName().value).toBe("Retain me");
  });
  it("does not translate selection values when the interface is Spanish", async () => {
    const saved = vi.fn();
    await render(
      <CompendiumLocale.Provider value="es">
        <PublicationManager
          indexed={indexed}
          profiles={[base, second]}
          activeProfileId={base.id}
          onSave={saved}
          onActivate={async () => {}}
          onDelete={async () => {}}
          onPreview={() => {}}
        />
      </CompendiumLocale.Provider>,
    );
    const include = container.querySelector<HTMLInputElement>(
      ".publication-selection-checks input",
    )!;
    await act(async () => include.click());
    await click("Guardar y activar");
    expect(saved.mock.calls[0][0].selection.entityIds.include).toEqual([
      indexed.entities[0].id,
    ]);
    expect(saved.mock.calls[0][0].rules.statuses).toEqual(base.rules.statuses);
  });
});

it("translates generated diagnostics without translating document paths, IDs or custom content", () => {
  const message = "Personajes/Aster.md is missing required entity frontmatter.";
  expect(formatCompendiumDiagnostic(message, "es")).toBe(
    "Personajes/Aster.md no incluye los metadatos obligatorios de la ficha.",
  );
  expect(formatCompendiumDiagnostic(message, "en")).toBe(message);
  expect(
    formatCompendiumDiagnostic(
      "Vault path does not exist: D:/My Universe",
      "es",
    ),
  ).toBe("No existe la carpeta del universo: D:/My Universe");
  expect(formatCompendiumDiagnostic("Authored English sentence", "es")).toBe(
    "Authored English sentence",
  );
});
