import { useEffect, useRef } from "react";

/** A mounted Suite session owns global keys only while its surface is active. */
export function useActiveAppKeydown(
  active: boolean | undefined,
  onKeyDown: (event: KeyboardEvent) => void,
) {
  const current = useRef({ active, onKeyDown });
  current.current = { active, onKeyDown };
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (current.current.active !== false) current.current.onKeyDown(event);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
}
