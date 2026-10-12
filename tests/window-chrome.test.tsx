// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useStandaloneWindowClose } from "../src/components/WindowTitleControls";
import { handleWindowTitlebarMouseDown } from "../src/windowTitlebar";

const windowMocks = vi.hoisted(() => ({
  close: vi.fn<() => Promise<void>>(),
  startDragging: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  onCloseRequested: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => windowMocks,
}));
vi.mock("../src/tauriBridge", () => ({ isTauriRuntime: () => true }));

let container: HTMLDivElement;
let root: Root;
let requestClose: (event: { preventDefault: () => void }) => void;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  windowMocks.close.mockResolvedValue(undefined);
  windowMocks.onCloseRequested.mockImplementation((listener) => {
    requestClose = listener;
    return Promise.resolve(vi.fn());
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

function Session({
  enabled = true,
  beforeClose,
}: {
  enabled?: boolean;
  beforeClose: () => Promise<boolean>;
}) {
  useStandaloneWindowClose(enabled, beforeClose);
  return null;
}

it("waits for deferred writes/editor guards before closing and allows the guarded close through", async () => {
  let resolveGuard!: (ready: boolean) => void;
  const guard = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        resolveGuard = resolve;
      }),
  );
  await act(async () => root.render(<Session beforeClose={guard} />));
  const event = { preventDefault: vi.fn() };
  await act(async () => requestClose(event));
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(windowMocks.close).not.toHaveBeenCalled();
  await act(async () => resolveGuard(true));
  expect(windowMocks.close).toHaveBeenCalledOnce();
  const finalEvent = { preventDefault: vi.fn() };
  requestClose(finalEvent);
  expect(finalEvent.preventDefault).not.toHaveBeenCalled();
  expect(guard).toHaveBeenCalledOnce();
});

it("keeps the window open when an editor or deferred write rejects closing", async () => {
  const guard = vi.fn(async () => false);
  await act(async () => root.render(<Session beforeClose={guard} />));
  await act(async () => requestClose({ preventDefault: vi.fn() }));
  expect(windowMocks.close).not.toHaveBeenCalled();
});

it("lets the Suite own close requests for an embedded session", async () => {
  await act(async () =>
    root.render(<Session enabled={false} beforeClose={async () => true} />),
  );
  expect(windowMocks.onCloseRequested).not.toHaveBeenCalled();
});

it("drags blank titlebar space and ignores controls and menu descendants", () => {
  const blank = document.createElement("span");
  handleWindowTitlebarMouseDown({ button: 0, detail: 1, target: blank });
  expect(windowMocks.startDragging).toHaveBeenCalledOnce();
  handleWindowTitlebarMouseDown({ button: 0, detail: 2, target: blank });
  expect(windowMocks.toggleMaximize).toHaveBeenCalledOnce();
  const menu = document.createElement("div");
  menu.setAttribute("role", "menu");
  menu.append(blank);
  handleWindowTitlebarMouseDown({ button: 0, detail: 1, target: blank });
  const button = document.createElement("button");
  button.append(blank);
  handleWindowTitlebarMouseDown({ button: 0, detail: 2, target: blank });
  handleWindowTitlebarMouseDown({
    button: 2,
    detail: 1,
    target: document.body,
  });
  expect(windowMocks.startDragging).toHaveBeenCalledOnce();
  expect(windowMocks.toggleMaximize).toHaveBeenCalledOnce();
});
