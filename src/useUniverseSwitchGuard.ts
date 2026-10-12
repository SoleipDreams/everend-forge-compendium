import { useEffect, useRef } from "react";
import type { SuiteChrome } from "./suiteChrome";

export type RegisterUniverseSwitchGuard = NonNullable<
  SuiteChrome["registerUniverseSwitchGuard"]
>;

/** Register once; read current draft state even when the application is hidden. */
export function useUniverseSwitchGuard(
  register: RegisterUniverseSwitchGuard | undefined,
  blocked: boolean,
) {
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  useEffect(() => register?.(async () => !blockedRef.current), [register]);
}
