// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationStore,
  NOTIFICATION_DURATION,
  NOTIFICATION_LIMIT,
} from "../src/notificationStore";
import {
  NotificationProvider,
  NotificationBell,
  useNotify,
  useNotificationMessage,
} from "../src/notifications";

describe("Notification history", () => {
  it("coalesces bursts, replaces the transient notice, and keeps expired notices available in a bounded history", () => {
    vi.useFakeTimers();
    const store = createNotificationStore();
    store.publish({ message: "Saved", source: "WorldNotion", kind: "success" });
    store.publish({ message: "Saved", source: "WorldNotion", kind: "success" });
    expect(store.getSnapshot().entries).toHaveLength(1);
    expect(store.getSnapshot().entries[0].count).toBe(2);
    store.publish({
      message: "Write failed",
      source: "PathBranching",
      kind: "error",
    });
    const errorId = store.getSnapshot().toast!;
    store.dismissToast(errorId);
    expect(store.getSnapshot().entries.map((entry) => entry.message)).toEqual([
      "Write failed",
      "Saved",
    ]);
    expect(store.getSnapshot().toast).toBeUndefined();
    for (let i = 0; i < 70; i++) store.publish({ message: `Notice ${i}` });
    expect(store.getSnapshot().entries).toHaveLength(NOTIFICATION_LIMIT);
    store.markRead();
    expect(store.getSnapshot().entries.every((entry) => !entry.unread)).toBe(
      true,
    );
    store.clear();
    expect(store.getSnapshot().entries).toEqual([]);
    vi.useRealTimers();
  });
  it("retains silent notices, scopes deduplication by source, and dismissing an old toast does not remove a new one", () => {
    const store = createNotificationStore();
    store.publish({ message: "Saved", source: "A" });
    const first = store.getSnapshot().toast!;
    store.publish({ message: "Saved", source: "B", silent: true });
    expect(store.getSnapshot().toast).toBe(first);
    store.publish({ message: "New" });
    const current = store.getSnapshot().toast;
    store.dismissToast(first);
    expect(store.getSnapshot().toast).toBe(current);
    expect(store.getSnapshot().entries).toHaveLength(3);
  });
});

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.useFakeTimers();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function render(view: ReactNode) {
  await act(async () => root.render(view));
}
function button(label: string) {
  const found = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.getAttribute("aria-label") === label || item.textContent === label,
  );
  if (!found) throw Error(label);
  return found;
}
async function click(label: string) {
  await act(async () => button(label).click());
}
function Trigger() {
  const notify = useNotify();
  return (
    <button
      onClick={() => notify({ message: "Saved document", kind: "success" })}
    >
      Notify
    </button>
  );
}
function Scene({ active = true }: { active?: boolean }) {
  return (
    <NotificationProvider active={active} source="Compendium">
      <NotificationBell locale="es" />
      <Trigger />
    </NotificationProvider>
  );
}

describe("Notification presentation", () => {
  it("expires without taking focus, remains in the bell, and Escape returns focus to the opener", async () => {
    await render(<Scene />);
    button("Notify").focus();
    await click("Notify");
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "Saved document",
    );
    expect(document.activeElement).toBe(button("Notify"));
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATION_DURATION.success + 1);
    });
    expect(document.querySelector(".ef-notification-toast")).toBeNull();
    const bell = button("Notificaciones (1)");
    await act(async () => bell.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "Saved document",
    );
    expect(button("Notificaciones").getAttribute("aria-expanded")).toBe("true");
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(bell);
  });
  it("pauses expiration while hovered or focused, resumes the remaining duration, and supports manual dismissal", async () => {
    await render(<Scene />);
    await click("Notify");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    const toast = document.querySelector(".ef-notification-toast")!;
    await act(async () =>
      toast.dispatchEvent(new Event("pointerover", { bubbles: true })),
    );
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(document.querySelector(".ef-notification-toast")).not.toBeNull();
    await act(async () =>
      toast.dispatchEvent(new Event("pointerout", { bubbles: true })),
    );
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector(".ef-notification-toast")).not.toBeNull();
    await click("Cerrar aviso");
    expect(document.querySelector(".ef-notification-toast")).toBeNull();
    await click("Notificaciones (1)");
    expect(
      document.querySelector(".ef-notification-entry")?.textContent,
    ).toContain("Saved document");
    await click("Vaciar notificaciones");
    expect(
      document.querySelector(".ef-notification-center")?.textContent,
    ).toContain("No hay notificaciones");
  });
  it("routes all tool notices to the Suite host and closes a portal when its app is hidden", async () => {
    const publish = vi.fn(),
      renderBell = vi.fn(() => <button>Suite bell</button>);
    await render(
      <NotificationProvider
        host={{ publish, renderBell }}
        source="PathBranching"
      >
        <NotificationBell />
        <Trigger />
      </NotificationProvider>,
    );
    await click("Notify");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Saved document",
        source: "PathBranching",
      }),
    );
    expect(document.querySelector(".ef-notification-toast")).toBeNull();
    await render(<Scene />);
    await click("Notificaciones");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await render(<Scene active={false} />);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
  it("records one notice when a retained operation state rerenders and preserves actions after expiration", async () => {
    const action = vi.fn();
    function State({ message }: { message: string }) {
      useNotificationMessage(message, "error", {
        action: { label: "Retry", run: action },
      });
      return <NotificationBell />;
    }
    const view = (
      <NotificationProvider>
        <State message="Disk full" />
      </NotificationProvider>
    );
    await render(view);
    await render(view);
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATION_DURATION.error + 1);
    });
    await click("Notifications (1)");
    await click("Retry");
    expect(action).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe("Notification accessibility and failures", () => {
  it("pauses while keyboard focus is inside and resumes after focus leaves", async () => {
    await render(<Scene />);
    await click("Notify");
    await act(async () => {
      button("Cerrar aviso").focus();
    });
    await act(async () => {
      vi.advanceTimersByTime(20000);
    });
    expect(document.querySelector(".ef-notification-toast")).not.toBeNull();
    await act(async () => button("Notify").focus());
    await act(async () => {
      vi.advanceTimersByTime(NOTIFICATION_DURATION.success + 1);
    });
    expect(document.querySelector(".ef-notification-toast")).toBeNull();
  });
  it("retains an action failure as a new error notice", async () => {
    function Failure() {
      useNotificationMessage("Retry needed", "error", {
        action: {
          label: "Retry",
          run: async () => {
            throw Error("Disk unavailable");
          },
        },
      });
      return <NotificationBell />;
    }
    await render(
      <NotificationProvider source="PathBranching">
        <Failure />
      </NotificationProvider>,
    );
    await click("Retry");
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "Disk unavailable",
    );
    await click("Notifications (2)");
    expect(document.querySelectorAll(".ef-notification-entry")).toHaveLength(2);
  });
});
