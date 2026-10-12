import { useEffect, useLayoutEffect, useRef } from "react";

type DialogFocusOptions = {
  visible?: boolean;
  active?: boolean;
  canClose?: boolean;
  onClose: () => void;
};

const dialogStack: symbol[] = [];
const focusableSelector =
  'summary, button, input, select, textarea, a[href], iframe, [tabindex], [contenteditable="true"]';

function available(element: HTMLElement | null): element is HTMLElement {
  if (
    !element?.isConnected ||
    element.closest(
      '[hidden], [inert], [aria-hidden="true"], [data-app-active="false"]',
    )
  )
    return false;
  for (
    let parent: HTMLElement | null = element;
    parent;
    parent = parent.parentElement
  ) {
    if (
      parent instanceof HTMLDetailsElement &&
      !parent.open &&
      !parent.querySelector(":scope > summary")?.contains(element)
    )
      return false;
    const style = window.getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}

function tabbable(root: HTMLElement) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(":disabled") &&
      available(element),
  );
}

/** Retained dialogs own focus only while visible in the active application. */
export function useDialogFocus({
  visible = true,
  active = true,
  canClose = true,
  onClose,
}: DialogFocusOptions) {
  const dialogRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const current = useRef({ visible, active, canClose, onClose });
  useLayoutEffect(() => {
    current.current = { visible, active, canClose, onClose };
  }, [visible, active, canClose, onClose]);

  useEffect(() => {
    if (!visible) {
      opener.current = null;
      return;
    }
    const dialog = dialogRef.current;
    if (!active || !available(dialog)) return;
    if (
      !opener.current &&
      document.activeElement instanceof HTMLElement &&
      !dialog.contains(document.activeElement)
    ) {
      opener.current = document.activeElement;
    }
    const token = Symbol("compendium-dialog");
    dialogStack.push(token);
    const ownsFocus = () =>
      current.current.visible &&
      current.current.active &&
      dialogStack.at(-1) === token &&
      available(dialog);
    const focusInside = (last = false) => {
      if (!ownsFocus()) return;
      const controls = tabbable(dialog);
      (last ? controls.at(-1) : controls[0])?.focus();
      if (!controls.length) dialog.focus();
    };
    if (!dialog.contains(document.activeElement)) focusInside();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ownsFocus()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (current.current.canClose) current.current.onClose();
      } else if (event.key === "Tab") {
        const controls = tabbable(dialog);
        const focused = document.activeElement;
        if (
          !controls.length ||
          !dialog.contains(focused) ||
          focused === dialog ||
          (event.shiftKey
            ? focused === controls[0]
            : focused === controls.at(-1))
        ) {
          event.preventDefault();
          event.stopPropagation();
          focusInside(event.shiftKey);
        }
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (ownsFocus() && !dialog.contains(event.target as Node)) focusInside();
    };
    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      const index = dialogStack.indexOf(token);
      if (index >= 0) dialogStack.splice(index, 1);
      // Inactivation leaves the active tool's focus alone; closing restores its trigger.
      if (current.current.active && available(opener.current))
        opener.current.focus();
    };
  }, [visible, active]);
  return dialogRef;
}
