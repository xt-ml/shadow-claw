module.exports = {
  process(sourceText, sourcePath) {
    const escaped = sourceText.replace(/`/g, "\\`").replace(/\${/g, "\\${");

    return {
      code: `
        const doc = new DOMParser().parseFromString(\`${escaped}\`, 'text/html');
        const templateEl = doc.querySelector('template');
        let elements = [];

        if (templateEl) {
          elements = Array.from(templateEl.content.children);
        } else {
          elements = Array.from(doc.head.children).concat(Array.from(doc.body.children));
        }

        module.exports = elements;
      `,
    };
  },
};
