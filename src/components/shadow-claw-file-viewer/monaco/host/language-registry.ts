/**
 * Lazy language registry for the Monaco host.
 *
 * Each language (or language service) is registered with a `load()` function
 * that dynamically imports its Monaco contribution. Loading happens on demand
 * the first time a file of that language is opened. This file has no
 * `monaco-editor` import, so it is unit-testable.
 *
 * To add a language in the future, call `registry.register({...})` (see
 * `builtin-languages.ts`).
 */
export interface LanguageSupport {
  id: string;
  /** Other language ids that must be loaded first (e.g. embedded fences). */
  dependencies?: string[];
  load: () => Promise<unknown>;
}

export interface LanguageRegistryOptions {
  onError?: (id: string, error: unknown) => void;
}

export interface LanguageRegistry {
  register(support: LanguageSupport): void;
  has(id: string): boolean;
  ids(): string[];
  /** Resolves true when the language is available, false otherwise. */
  ensure(id: string): Promise<boolean>;
}

export function createLanguageRegistry(
  options: LanguageRegistryOptions = {},
): LanguageRegistry {
  const supports = new Map<string, LanguageSupport>();
  const loads = new Map<string, Promise<boolean>>();

  async function ensure(id: string, seen: Set<string> = new Set()) {
    const support = supports.get(id);
    if (!support) {
      return false;
    }

    const existing = loads.get(id);
    if (existing) {
      return existing;
    }

    if (seen.has(id)) {
      return true;
    }

    seen.add(id);

    const promise = (async () => {
      try {
        for (const dep of support.dependencies ?? []) {
          await ensure(dep, seen);
        }

        await support.load();

        return true;
      } catch (error) {
        loads.delete(id);
        options.onError?.(id, error);

        return false;
      }
    })();

    loads.set(id, promise);

    return promise;
  }

  return {
    register(support) {
      supports.set(support.id, support);
    },
    has: (id) => supports.has(id),
    ids: () => Array.from(supports.keys()),
    ensure: (id) => ensure(id),
  };
}
