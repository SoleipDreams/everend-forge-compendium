// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { PublicationManager } from "../src/components/PublicationManager";
import { CorrectionDialog } from "../src/components/CorrectionDialog";
import { assembleIndexedUniverse } from "../src/lib/assemble";
import { createDefaultPublicationProfile } from "../src/lib/publications";
import { sanitizeDom } from "../src/lib/sanitize-dom";
import { saveUniverseTextFile } from "../src/tauriBridge";
import {
  useUniverseSwitchGuard,
  type RegisterUniverseSwitchGuard,
} from "../src/useUniverseSwitchGuard";

vi.mock("../src/tauriBridge", () => ({ saveUniverseTextFile: vi.fn() }));

type Guard = () => Promise<boolean>;
function registry() {
  const guards = new Set<Guard>();
  const register: RegisterUniverseSwitchGuard = vi.fn((guard) => {
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  });
  return {
    register,
    guards,
    canSwitch: async () =>
      (await Promise.all([...guards].map((guard) => guard()))).every(Boolean),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const indexed = assembleIndexedUniverse(
  "guard-test-vault",
  [
    {
      relativePath: "Characters/Aster.md",
      content:
        "---\nid: character:aster\ntype: character\nname: Aster\nstatus: canon\n---\nA short biography.\n",
    },
  ],
  sanitizeDom,
);

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.mocked(saveUniverseTextFile).mockReset();
  vi.stubGlobal("crypto", {
    subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function render(view: ReactNode) {
  await act(async () => root.render(view));
}
function input(label: string) {
  const element = [...container.querySelectorAll("label")]
    .find((item) => item.querySelector("span")?.textContent === label)
    ?.querySelector("input, textarea");
  if (!(
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ))
    throw new Error(`Missing input: ${label}`);
  return element;
}
async function change(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      element,
      value,
    );
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function button(name: string) {
  const element = [...container.querySelectorAll("button")].find(
    (item) => item.textContent?.trim() === name || item.title === name,
  );
  if (!element) throw new Error(`Missing button: ${name}`);
  return element;
}
async function click(name: string) {
  await act(async () => button(name).click());
}

describe("universe switch draft guards", () => {
  it("keeps a settings draft registered and current when another settings section hides it", async () => {
    const guard = registry();
    function DraftEditor() {
      const [text, setText] = useState("");
      useUniverseSwitchGuard(guard.register, Boolean(text));
      return (
        <label>
          <span>Draft name</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      );
    }
    const view = (section: "universe" | "appearance") => (
      <SettingsDialog
        section={section}
        onSectionChange={vi.fn()}
        onClose={vi.fn()}
        appearance={<p>Appearance controls</p>}
        universe={<DraftEditor />}
        onOpenDocs={vi.fn()}
        localePreference="en"
        onLocalePreferenceChange={vi.fn()}
      />
    );
    await render(view("universe"));
    expect(await guard.canSwitch()).toBe(true);
    await change(input("Draft name"), "Unsaved universe");
    await render(view("appearance"));
    expect(
      container.querySelector("[hidden]")?.contains(input("Draft name")),
    ).toBe(true);
    expect(guard.guards.size).toBe(1);
    expect(await guard.canSwitch()).toBe(false);
    await render(view("universe"));
    expect(input("Draft name").value).toBe("Unsaved universe");
    await change(input("Draft name"), "");
    expect(await guard.canSwitch()).toBe(true);
    await act(async () => root.unmount());
    root = createRoot(container);
    expect(guard.guards.size).toBe(0);
  });

  it("retains an actual publication draft while its workspace is hidden", async () => {
    const guard = registry();
    const profile = createDefaultPublicationProfile(indexed.config);
    const view = (hidden: boolean) => (
      <div hidden={hidden}>
        <PublicationManager
          indexed={indexed}
          profiles={[profile]}
          activeProfileId={profile.id}
          onSave={vi.fn()}
          onActivate={vi.fn()}
          onDelete={vi.fn()}
          onPreview={vi.fn()}
          registerUniverseSwitchGuard={guard.register}
        />
      </div>
    );
    await render(view(false));
    expect(await guard.canSwitch()).toBe(true);
    await change(input("Profile name"), "Reader edition");
    await render(view(true));
    expect(await guard.canSwitch()).toBe(false);
    expect(guard.guards.size).toBe(1);
    await render(view(false));
    expect(input("Profile name").value).toBe("Reader edition");
  });

  it("blocks publication navigation and edits until an initiated save finishes", async () => {
    const guard = registry();
    const profile = createDefaultPublicationProfile(indexed.config);
    const pending = deferred<void>();
    const save = vi.fn(() => pending.promise);
    const activate = vi.fn().mockResolvedValue(undefined);
    const view = (savedName: string) => (
      <PublicationManager
        indexed={indexed}
        profiles={[{ ...profile, name: savedName }]}
        activeProfileId={profile.id}
        onSave={save}
        onActivate={activate}
        onDelete={vi.fn()}
        onPreview={vi.fn()}
        registerUniverseSwitchGuard={guard.register}
      />
    );
    await render(view(profile.name));
    await change(input("Profile name"), "Saved reader edition");
    await click("Save and activate");
    expect(await guard.canSwitch()).toBe(false);
    expect(input("Profile name").matches(":disabled")).toBe(true);
    await click("New profile");
    await click("Duplicate");
    expect(input("Profile name").value).toBe("Saved reader edition");
    await act(async () => {
      pending.resolve(undefined);
    });
    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Saved reader edition" }),
    );
    await render(view("Saved reader edition"));
    expect(await guard.canSwitch()).toBe(true);
    expect(input("Profile name").matches(":disabled")).toBe(false);
  });

  it("keeps a failed publication save visible and blocks a switch", async () => {
    const guard = registry();
    const profile = createDefaultPublicationProfile(indexed.config);
    await render(
      <PublicationManager
        indexed={indexed}
        profiles={[profile]}
        activeProfileId={profile.id}
        onSave={vi.fn().mockRejectedValue(new Error("Disk full"))}
        onActivate={vi.fn()}
        onDelete={vi.fn()}
        onPreview={vi.fn()}
        registerUniverseSwitchGuard={guard.register}
      />,
    );
    await change(input("Profile name"), "Pending edition");
    await click("Save and activate");
    expect(container.textContent).toContain("Disk full");
    expect(input("Profile name").value).toBe("Pending edition");
    expect(await guard.canSwitch()).toBe(false);
    expect(input("Profile name").matches(":disabled")).toBe(false);
  });

  it("keeps a correction mounted and guarded through close attempts during a write", async () => {
    const guard = registry();
    const pending = deferred<{ ok: boolean }>();
    vi.mocked(saveUniverseTextFile).mockReturnValue(pending.promise);
    const close = vi.fn();
    await render(
      <CorrectionDialog
        site={indexed}
        entity={indexed.entities[0]}
        onClose={close}
        registerUniverseSwitchGuard={guard.register}
      />,
    );
    await change(input("Proposed Markdown"), "Revised biography.");
    await click("Send to WorldNotion review");
    expect(saveUniverseTextFile).toHaveBeenCalledTimes(1);
    expect(await guard.canSwitch()).toBe(false);
    expect(input("Proposed Markdown").disabled).toBe(true);
    await click("Close");
    await click("Cancel");
    await act(async () => {
      container
        .querySelector(".dialog-backdrop")!
        .dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      container
        .querySelector('[role="dialog"]')!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
    });
    expect(close).not.toHaveBeenCalled();
    expect(guard.guards.size).toBe(1);
    expect(await guard.canSwitch()).toBe(false);
    await act(async () => {
      pending.resolve({ ok: true });
    });
    expect(container.textContent).toContain("Correction ready for review");
    expect(await guard.canSwitch()).toBe(true);
    await click("Done");
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("restores correction controls after hashing fails and retains the guarded draft", async () => {
    const guard = registry();
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockRejectedValue(new Error("Hash unavailable")),
      },
    });
    await render(
      <CorrectionDialog
        site={indexed}
        entity={indexed.entities[0]}
        onClose={vi.fn()}
        registerUniverseSwitchGuard={guard.register}
      />,
    );
    await change(input("Proposed Markdown"), "Revised biography.");
    await click("Send to WorldNotion review");
    expect(container.textContent).toContain("Hash unavailable");
    expect(input("Proposed Markdown").disabled).toBe(false);
    expect(input("Proposed Markdown").value).toBe("Revised biography.");
    expect(saveUniverseTextFile).not.toHaveBeenCalled();
    expect(await guard.canSwitch()).toBe(false);
  });
});
