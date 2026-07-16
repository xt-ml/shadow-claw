// Global polyfill helper block to capture JSDOM mutations on the fly
if (
  typeof ShadowRoot !== "undefined" &&
  !ShadowRoot.prototype.__patchedForTesting
) {
  ShadowRoot.prototype.__patchedForTesting = true;

  const originalAdoptedSet = Object.getOwnPropertyDescriptor(
    ShadowRoot.prototype,
    "adoptedStyleSheets",
  )?.set;

  Object.defineProperty(ShadowRoot.prototype, "adoptedStyleSheets", {
    set(sheets) {
      if (originalAdoptedSet) {
        originalAdoptedSet.call(this, sheets);
      }

      // Appends the raw CSS text to a fake <style> block exclusively for test assertions
      if (Array.isArray(sheets)) {
        sheets.forEach((sheet) => {
          if (sheet && sheet.cssText) {
            const styleEl = document.createElement("style");
            styleEl.textContent = sheet.cssText;
            this.appendChild(styleEl);
          }
        });
      }
    },
    configurable: true,
  });
}

module.exports = {
  process(sourceText, sourcePath) {
    // Escape backticks and template expressions just in case
    const escaped = sourceText.replace(/`/g, "\\`").replace(/\${/g, "\\${");

    return {
      code: `
        const sheet = typeof CSSStyleSheet !== 'undefined' ? new CSSStyleSheet() : { replaceSync: () => {} };

        if (typeof sheet.replaceSync === 'function') {
          sheet.replaceSync(\`${escaped}\`);
        }

        // Expose the raw string text directly on the object so our test patch can find it
        sheet.cssText = \`${escaped}\`;

        module.exports = sheet;
      `,
    };
  },
};
