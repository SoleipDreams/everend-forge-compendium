// @vitest-environment jsdom
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "../src/components/SettingsDialog";
import { CorrectionDialog } from "../src/components/CorrectionDialog";
import { FeedbackModal } from "../src/components/FeedbackModal";
import { assembleIndexedUniverse } from "../src/lib/assemble";
import { sanitizeDom } from "../src/lib/sanitize-dom";
import { saveUniverseTextFile } from "../src/tauriBridge";
import { useUniverseSwitchGuard } from "../src/useUniverseSwitchGuard";

vi.mock("../src/tauriBridge", () => ({ saveUniverseTextFile: vi.fn() }));

const indexed = assembleIndexedUniverse(
  "focus-test-vault",
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
let trigger: HTMLButtonElement;
let background: HTMLButtonElement;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  trigger = document.createElement("button");
  trigger.textContent = "Open settings";
  background = document.createElement("button");
  background.textContent = "Stories behind dialog";
  container = document.createElement("div");
  document.body.append(trigger, background, container);
  root = createRoot(container);
  trigger.focus();
  vi.mocked(saveUniverseTextFile).mockReset();
  vi.stubGlobal("crypto", {
    subtle: { digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)) },
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  trigger.remove();
  background.remove();
  container.remove();
  vi.unstubAllGlobals();
});
async function render(view: ReactNode) {
  await act(async () => root.render(view));
}
async function key(value: string, shiftKey = false) {
  const event = new KeyboardEvent("keydown", {
    key: value,
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  await act(async () =>
    (document.activeElement ?? window).dispatchEvent(event),
  );
  return event;
}
async function change(
  input: HTMLInputElement | HTMLTextAreaElement,
  value: string,
) {
  await act(async () => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(
      input,
      value,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function dialog() {
  const element = container.querySelector<HTMLElement>('[role="dialog"]');
  if (!element) throw new Error("Missing dialog");
  return element;
}
function settings(
  visible: boolean,
  active: boolean,
  onClose: () => void,
  universe: ReactNode = <input defaultValue="Hidden draft" />,
) {
  return (
    <div className="forge-compendium" data-app-active={active} inert={!active}>
      <div hidden={!visible}>
        <SettingsDialog
          visible={visible}
          active={active}
          section="appearance"
          onSectionChange={vi.fn()}
          onClose={onClose}
          appearance={
            <button type="button" data-testid="last-setting">
              Last setting
            </button>
          }
          universe={universe}
          onOpenDocs={vi.fn()}
          localePreference="en"
          onLocalePreferenceChange={vi.fn()}
        />
      </div>
    </div>
  );
}

describe("Compendium dialog focus ownership", () => {
  it("focuses retained settings on opening, loops Tab around visible controls, blocks background focus and restores the opener", async () => {
    const onClose = vi.fn();
    await render(settings(false, true, onClose));
    expect(document.activeElement).toBe(trigger);
    await render(settings(true, true, onClose));
    const first = dialog().querySelector<HTMLButtonElement>(".dialog-close")!;
    const last = dialog().querySelector<HTMLButtonElement>(
      '[data-testid="last-setting"]',
    )!;
    expect(document.activeElement).toBe(first);
    expect((await key("Tab", true)).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    expect((await key("Tab")).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    background.focus();
    expect(dialog().contains(document.activeElement)).toBe(true);

    const otherEscape = vi.fn();
    window.addEventListener("keydown", otherEscape);
    expect((await key("Escape")).defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(otherEscape).not.toHaveBeenCalled();
    await render(settings(false, true, onClose));
    expect(document.activeElement).toBe(trigger);
    background.focus();
    expect(document.activeElement).toBe(background);
    expect((await key("Escape")).defaultPrevented).toBe(false);
    expect(otherEscape).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", otherEscape);
  });

  it("suspends hidden settings without resetting drafts or unregistering the draft guard and resumes focus on return", async () => {
    const guards = new Set<() => Promise<boolean>>();
    const register = (guard: () => Promise<boolean>) => {
      guards.add(guard);
      return () => {
        guards.delete(guard);
      };
    };
    function Draft() {
      const [name, setName] = useState("");
      useUniverseSwitchGuard(register, Boolean(name));
      return (
        <input
          aria-label="Universe draft"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      );
    }
    const onClose = vi.fn();
    const view = (active: boolean, visible = true) => (
      <div data-app-active={active} inert={!active}>
        <div hidden={!visible}>
          <SettingsDialog
            active={active}
            visible={visible}
            section="universe"
            onSectionChange={vi.fn()}
            onClose={onClose}
            appearance={null}
            universe={<Draft />}
            onOpenDocs={vi.fn()}
            localePreference="en"
            onLocalePreferenceChange={vi.fn()}
          />
        </div>
      </div>
    );
    await render(view(true));
    const draft = container.querySelector<HTMLInputElement>(
      '[aria-label="Universe draft"]',
    )!;
    await change(draft, "Aster's world");
    expect(await [...guards][0]()).toBe(false);
    await render(view(false));
    background.focus();
    expect(document.activeElement).toBe(background);
    expect((await key("Escape")).defaultPrevented).toBe(false);
    expect((await key("Tab")).defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(draft.value).toBe("Aster's world");
    expect(guards.size).toBe(1);
    expect(await [...guards][0]()).toBe(false);
    await render(view(true));
    expect(dialog().contains(document.activeElement)).toBe(true);
    expect(draft.value).toBe("Aster's world");
    await render(view(true, false));
    expect(document.activeElement).toBe(trigger);
    expect(draft.value).toBe("Aster's world");
    expect(await [...guards][0]()).toBe(false);
    await render(view(true));
    expect(dialog().contains(document.activeElement)).toBe(true);
    await render(null);
    expect(document.activeElement).toBe(trigger);
    expect(guards.size).toBe(0);
    expect((await key("Tab")).defaultPrevented).toBe(false);
  });

  it("activates feedback only in the visible app, traps Tab and handles Escape once with listener cleanup", async () => {
    const onClose = vi.fn();
    const view = (active: boolean) => (
      <div data-app-active={active} inert={!active}>
        <FeedbackModal
          active={active}
          screen="reader"
          onClose={onClose}
          onOpenExternal={vi.fn()}
        />
      </div>
    );
    await render(view(false));
    expect(document.activeElement).toBe(trigger);
    expect((await key("Escape")).defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    await render(view(true));
    const first = dialog().querySelector<HTMLButtonElement>(
      ".feedback-modal-close",
    )!;
    const links = dialog().querySelectorAll<HTMLButtonElement>(
      ".feedback-modal-link",
    );
    const last = links[links.length - 1];
    expect(document.activeElement).toBe(first);
    await key("Tab", true);
    expect(document.activeElement).toBe(last);
    await key("Tab");
    expect(document.activeElement).toBe(first);
    await key("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    await render(null);
    expect(document.activeElement).toBe(trigger);
    expect((await key("Escape")).defaultPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps correction focus contained and close locked during saving, including hide/resume", async () => {
    let finish!: (value: { ok: boolean }) => void;
    vi.mocked(saveUniverseTextFile).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const onClose = vi.fn();
    const entity = indexed.entities[0];
    const view = (active: boolean) => (
      <div data-app-active={active} inert={!active}>
        <CorrectionDialog
          active={active}
          site={indexed}
          entity={entity}
          onClose={onClose}
        />
      </div>
    );
    await render(view(true));
    const markdown = dialog().querySelector<HTMLTextAreaElement>("textarea")!;
    await change(markdown, `${entity.sourceContent}\nA correction.`);
    const submit = Array.from(dialog().querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Send to WorldNotion"),
    )!;
    await act(async () => submit.click());
    expect(saveUniverseTextFile).toHaveBeenCalledTimes(1);
    expect(markdown.disabled).toBe(true);
    expect((await key("Escape")).defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    background.focus();
    expect(document.activeElement).toBe(dialog());
    expect((await key("Tab")).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dialog());
    await render(view(false));
    background.focus();
    expect(document.activeElement).toBe(background);
    expect((await key("Escape")).defaultPrevented).toBe(false);
    await render(view(true));
    expect(document.activeElement).toBe(dialog());
    expect(markdown.value).toContain("A correction.");
    await act(async () => finish({ ok: true }));
    await key("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gives only the top visible dialog Escape and returns focus to the underlying dialog", async () => {
    const closeSettings = vi.fn();
    const closeFeedback = vi.fn();
    const view = (feedback: boolean) => (
      <>
        {settings(true, true, closeSettings)}
        {feedback ? (
          <FeedbackModal
            screen="reader"
            onClose={closeFeedback}
            onOpenExternal={vi.fn()}
          />
        ) : null}
      </>
    );
    await render(view(false));
    const settingsDialog = dialog();
    await render(view(true));
    await key("Escape");
    expect(closeFeedback).toHaveBeenCalledTimes(1);
    expect(closeSettings).not.toHaveBeenCalled();
    await render(view(false));
    expect(settingsDialog.contains(document.activeElement)).toBe(true);
    await key("Escape");
    expect(closeSettings).toHaveBeenCalledTimes(1);
  });

  it("does not capture keys or steal focus through a hidden or inert ancestor", async () => {
    const onClose = vi.fn();
    await render(settings(true, true, onClose));
    const frame = container.firstElementChild as HTMLElement;
    for (const attribute of ["hidden", "inert"]) {
      frame.setAttribute(attribute, "");
      background.focus();
      expect(document.activeElement).toBe(background);
      expect((await key("Escape")).defaultPrevented).toBe(false);
      expect((await key("Tab")).defaultPrevented).toBe(false);
      frame.removeAttribute(attribute);
    }
    expect(onClose).not.toHaveBeenCalled();
  });
});
