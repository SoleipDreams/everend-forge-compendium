import { afterEach, describe, expect, it, vi } from "vitest";
import { DeferredUniverseWrite } from "../src/lib/deferredUniverseWrite";

afterEach(() => vi.useRealTimers());

describe("universe appearance writes", () => {
  it("flushes the latest debounced edit before navigation", async () => {
    vi.useFakeTimers();
    const writer = new DeferredUniverseWrite();
    const saved: string[] = [];
    writer.schedule(async () => {
      saved.push("older");
    });
    writer.schedule(async () => {
      saved.push("latest");
    });
    expect(saved).toEqual([]);
    expect(await writer.flush()).toBe(true);
    await vi.runAllTimersAsync();
    expect(saved).toEqual(["latest"]);
  });
  it("waits for a running write and drains changes queued during it", async () => {
    vi.useFakeTimers();
    const writer = new DeferredUniverseWrite();
    const saved: string[] = [];
    let finish!: () => void;
    writer.schedule(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      saved.push("first");
    });
    const flush = writer.flush();
    writer.schedule(async () => {
      saved.push("next");
    });
    let ready = false;
    void flush.then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);
    finish();
    expect(await flush).toBe(true);
    expect(saved).toEqual(["first", "next"]);
  });
  it("blocks navigation on failure and retains the write for retry", async () => {
    const writer = new DeferredUniverseWrite();
    let attempts = 0;
    writer.schedule(async () => {
      if (++attempts === 1) throw new Error("Disk full");
    });
    expect(await writer.flush()).toBe(false);
    expect(writer.error).toBeInstanceOf(Error);
    expect(await writer.flush()).toBe(true);
    expect(attempts).toBe(2);
    expect(writer.error).toBeUndefined();
  });
});
