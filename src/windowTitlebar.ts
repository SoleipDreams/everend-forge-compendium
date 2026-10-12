import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauriRuntime } from "./tauriBridge";

export function handleWindowTitlebarMouseDown(
  event: Pick<MouseEvent, "button" | "detail" | "target">,
) {
  if (!isTauriRuntime() || event.button !== 0) return;
  if (
    event.target instanceof Element &&
    event.target.closest(
      "button, a, input, select, textarea, summary, details, [role='button'], [role='link'], [role='menu'], [role^='menuitem'], [contenteditable='true'], [data-tauri-drag-region='false']",
    )
  )
    return;
  const currentWindow = getCurrentWindow();
  const action =
    event.detail === 2
      ? currentWindow.toggleMaximize()
      : currentWindow.startDragging();
  void action.catch(() => undefined);
}
