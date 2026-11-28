// Holds one isolation file until its peer has written too. Without this, a file could check for the
// other file's row before that row exists, and pass without proving anything.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inject } from "vitest";

const BUDGET_MS = 20_000;

export async function meetPeer(me: "a" | "b"): Promise<void> {
  const marker = (name: "a" | "b") => join(inject("runDir"), `isolation-${name}`);
  writeFileSync(marker(me), "");
  const peer = marker(me === "a" ? "b" : "a");
  const deadline = Date.now() + BUDGET_MS;
  while (!existsSync(peer)) {
    if (Date.now() > deadline) {
      throw new Error("isolation.test.ts and isolation_b.test.ts must run together, on at least 2 workers");
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}
