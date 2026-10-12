// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useActiveAppKeydown } from "../src/useActiveAppKeydown";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function Session({
  active,
  onKey,
}: {
  active?: boolean;
  onKey: (event: KeyboardEvent) => void;
}) {
  useActiveAppKeydown(active, onKey);
  return <span hidden={active === false}>Mounted session</span>;
}
async function render(
  active: boolean | undefined,
  onKey: (event: KeyboardEvent) => void,
) {
  await act(async () => root.render(<Session active={active} onKey={onKey} />));
}
function escape() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
  );
}

it("suspends a mounted hidden session and resumes its current callback when shown", async () => {
  const first = vi.fn();
  const current = vi.fn();
  await render(true, first);
  escape();
  expect(first).toHaveBeenCalledTimes(1);
  await render(false, current);
  escape();
  expect(current).not.toHaveBeenCalled();
  expect(first).toHaveBeenCalledTimes(1);
  await render(true, current);
  escape();
  expect(current).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledTimes(1);
});

it("an inactive session cannot consume another app's key, including when mounted hidden", async () => {
  const consumer = vi.fn((event: KeyboardEvent) => event.preventDefault());
  await render(false, consumer);
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    cancelable: true,
  });
  window.dispatchEvent(event);
  expect(consumer).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
  await render(true, consumer);
  escape();
  expect(consumer).toHaveBeenCalledTimes(1);
});

it("standalone owns keys and unregisters its listener on unmount", async () => {
  const standalone = vi.fn();
  await render(undefined, standalone);
  escape();
  expect(standalone).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
  root = createRoot(container);
  escape();
  expect(standalone).toHaveBeenCalledTimes(1);
});
