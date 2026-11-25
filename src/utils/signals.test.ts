import { jest } from "@jest/globals";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { Signal, State, Computed, effect, batch } from "./signals.js";

describe("signals utility", () => {
  it("supports State, Computed, effect dispose cleanup, and batch", () => {
    const count = new State(2);
    const doubled = new Computed(() => count.get() * 2);

    expect(State).toBe(Signal.State);
    expect(Computed).toBe(Signal.Computed);
    expect(count.get()).toBe(2);
    expect(doubled.get()).toBe(4);

    count.set(5);
    expect(doubled.get()).toBe(10);

    const cleanup = jest.fn();
    const dispose = effect(() => {
      count.get();
      return cleanup;
    });

    expect(cleanup).not.toHaveBeenCalled();
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);

    const out = batch(() => {
      count.set(7);
      return "done";
    });
    expect(out).toBe("done");
    expect(doubled.get()).toBe(14);
  });

  it("tracks signal mutations asynchronously and batches updates under real signal-polyfill", () => {
    const effectPath = path.resolve(process.cwd(), "src/core/effect.ts");
    const script = `
      import assert from "node:assert/strict";
      import { Signal } from "signal-polyfill";
      import { effect } from ${JSON.stringify(effectPath)};

      const State = Signal.State;
      const Computed = Signal.Computed;

      const a = new State(1);
      const b = new State(2);
      const sum = new Computed(() => a.get() + b.get());

      const seen = [];
      const cleanups = [];
      const dispose = effect(() => {
        const cur = sum.get();
        seen.push(cur);
        return () => cleanups.push(cur);
      });

      assert.deepEqual(seen, [3]);
      assert.deepEqual(cleanups, []);

      a.set(10);
      b.set(20);

      await Promise.resolve();
      await Promise.resolve();
      assert.deepEqual(seen, [3, 30]);
      assert.deepEqual(cleanups, [3]);

      dispose();
      assert.deepEqual(cleanups, [3, 30]);

      a.set(100);
      await Promise.resolve();
      assert.deepEqual(seen, [3, 30]);
    `;

    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", script],
      { encoding: "utf8" },
    );

    if (result.status !== 0) {
      throw new Error(
        result.error?.message ||
          result.stderr ||
          result.stdout ||
          "Node signals failed",
      );
    }
    expect(result.status).toBe(0);
  });
});
