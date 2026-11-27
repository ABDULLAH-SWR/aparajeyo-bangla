import type { Clock } from "../../clock";

/** A clock that moves only when a test moves it. */
export function fixedClock(start = Date.parse("2026-11-20T06:00:00Z")) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number): void {
      current += ms;
    },
  } satisfies Clock & { advance(ms: number): void };
}
