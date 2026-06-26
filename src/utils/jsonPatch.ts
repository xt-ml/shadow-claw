/**
 * A lightweight JSON Patch (RFC 6902) implementation.
 * Supports add, replace, and remove operations on objects and arrays.
 */

export interface JsonPatchOperation {
  op: string;
  path: string;
  value?: unknown;
}

/**
 * Applies an array of JSON patch operations to a document.
 * Returns a deep clone of the document with the patches applied.
 */
export function applyJsonPatch<T extends Record<string, unknown> | unknown[]>(
  document: T,
  patches: JsonPatchOperation[],
): T {
  if (!document || typeof document !== "object") {
    return document;
  }

  // Deep clone to avoid mutating the original document
  const clone = JSON.parse(JSON.stringify(document)) as T;

  for (const patch of patches) {
    applySinglePatch(clone, patch);
  }

  return clone;
}

function applySinglePatch(
  root: Record<string, unknown> | unknown[],
  patch: JsonPatchOperation,
): void {
  const { op, path, value } = patch;
  if (!path || !path.startsWith("/")) {
    return;
  }

  const parts = path
    .split("/")
    .slice(1) // Remove leading empty string
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));

  const lastPart = parts.pop();
  if (lastPart === undefined) {
    return;
  }

  let current: any = root;
  for (const part of parts) {
    if (current === null || typeof current !== "object") {
      return; // Path does not exist
    }

    current = current[part];
  }

  if (current === null || typeof current !== "object") {
    return;
  }

  if (Array.isArray(current)) {
    applyToArray(current, lastPart, op, value);
  } else {
    applyToObject(current, lastPart, op, value);
  }
}

function applyToArray(
  arr: unknown[],
  key: string,
  op: string,
  value: unknown,
): void {
  if (op === "add") {
    if (key === "-") {
      arr.push(value);
    } else {
      const index = parseInt(key, 10);
      if (!isNaN(index) && index >= 0 && index <= arr.length) {
        arr.splice(index, 0, value);
      }
    }
  } else if (op === "replace") {
    const index = parseInt(key, 10);
    if (!isNaN(index) && index >= 0 && index < arr.length) {
      arr[index] = value;
    }
  } else if (op === "remove") {
    const index = parseInt(key, 10);
    if (!isNaN(index) && index >= 0 && index < arr.length) {
      arr.splice(index, 1);
    }
  }
}

function applyToObject(
  obj: Record<string, unknown>,
  key: string,
  op: string,
  value: unknown,
): void {
  if (op === "add" || op === "replace") {
    obj[key] = value;
  } else if (op === "remove") {
    delete obj[key];
  }
}
