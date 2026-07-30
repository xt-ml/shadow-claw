const hooks = {
  uponSanitizeElement: [],
  afterSanitizeElements: [],
};

exports.addHook = (entryPoint, fn) => {
  if (hooks[entryPoint]) {
    hooks[entryPoint].push(fn);
  }
};

exports.removeHook = (entryPoint) => {
  if (hooks[entryPoint]) {
    hooks[entryPoint] = [];
  }
};

exports.removeAllHooks = () => {
  hooks.uponSanitizeElement = [];
  hooks.afterSanitizeElements = [];
};

exports.sanitize = (val, options) => {
  if (typeof val !== "string") {
    return val;
  }

  // Strip script tags by default
  let clean = val.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

  // If running in DOM environment (JSDOM/browser)
  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = clean;

    // Run DOMPurify hooks
    if (
      hooks.uponSanitizeElement.length > 0 ||
      hooks.afterSanitizeElements.length > 0
    ) {
      const runHooks = (node) => {
        const children = Array.from(node.children || []);
        for (const child of children) {
          const data = {
            tagName: child.tagName ? child.tagName.toLowerCase() : "",
          };
          for (const hook of hooks.uponSanitizeElement) {
            hook(child, data);
          }
          for (const hook of hooks.afterSanitizeElements) {
            hook(child, data);
          }
          runHooks(child);
        }
      };

      runHooks(container);
      clean = container.innerHTML;
    }

    // Handle ALLOWED_TAGS filtering if explicitly provided
    if (options && Array.isArray(options.ALLOWED_TAGS)) {
      const allowed = new Set(options.ALLOWED_TAGS.map((t) => t.toLowerCase()));
      if (options.ADD_TAGS && Array.isArray(options.ADD_TAGS)) {
        options.ADD_TAGS.forEach((t) => allowed.add(t.toLowerCase()));
      }

      const filterNode = (node) => {
        const children = Array.from(node.children || []);
        for (const child of children) {
          filterNode(child);
          const tag = child.tagName ? child.tagName.toLowerCase() : "";
          if (tag && !allowed.has(tag)) {
            child.remove();
          }
        }
      };

      const filterContainer = document.createElement("div");
      filterContainer.innerHTML = clean;
      filterNode(filterContainer);
      clean = filterContainer.innerHTML;
    }
  }

  return clean;
};

module.exports = exports;
