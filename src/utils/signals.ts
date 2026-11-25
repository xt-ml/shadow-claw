import { Signal } from "signal-polyfill";
import { effect } from "../core/effect.js";

export { Signal, effect };

export const State = Signal.State;
export const Computed = Signal.Computed;

/**
 * Executes `fn` synchronously and returns its result.
 * Synchronous signal mutations within `fn` naturally batch into a single
 * microtask effect flush under `effect()`.
 */
export function batch<T>(fn: () => T): T {
  return fn();
}
