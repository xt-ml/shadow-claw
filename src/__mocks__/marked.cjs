let activeRenderer = {};

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderCodeBlock(text, lang) {
  if (typeof activeRenderer.code === "function") {
    return activeRenderer.code({ text, lang });
  }

  const languageClass = lang ? ` class="language-${lang}"` : "";

  return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
}

function renderHeadingBlock(text, depth) {
  if (typeof activeRenderer.heading === "function") {
    const token = {
      text,
      depth,
      tokens: [{ type: "text", raw: text, text }],
    };

    return activeRenderer.heading.call(
      {
        parser: {
          parseInline: (tokens) =>
            Array.isArray(tokens)
              ? tokens.map((tokenItem) => tokenItem.text || "").join("")
              : String(text),
        },
        options: { headingCounts: new Map() },
      },
      token,
      depth,
    );
  }

  const slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `<h${depth} id="${slug}">${escapeHtml(text)}</h${depth}>`;
}

exports.marked = {
  parse: (val, options) => {
    if (typeof val !== "string") {
      return val;
    }

    let input = val;
    if (/^---\n[\s\S]*?\n---\n?/.test(input)) {
      input = input.replace(/^---\n[\s\S]*?\n---\n?/, "");
    }

    const codeBlocks = [];
    let res = input.replace(/```([^\n`]*)\n([\s\S]*?)\n```/g, (_, lang, text) => {
      const index = codeBlocks.length;
      const normalizedLang = typeof lang === "string" ? lang.trim() : "";

      codeBlocks.push(renderCodeBlock(text, normalizedLang || undefined));

      return `@@MOCK_CODE_BLOCK_${index}@@`;
    });

    res = res.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
      return renderHeadingBlock(text, hashes.length);
    });

    res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    res = res.replace(/\n\n/g, "</p><p>");

    if (options?.breaks) {
      res = res.replace(/\n/g, "<br>");
    }

    if (val.includes("\n\n") || !val.includes("\n")) {
      res = `<p>${res}</p>`;
    }

    res = res.replace(/@@MOCK_CODE_BLOCK_(\d+)@@/g, (_, index) => {
      return codeBlocks[Number(index)] || "";
    });

    return res;
  },
  use: (options) => {
    if (options && options.renderer) {
      activeRenderer = {
        ...activeRenderer,
        ...options.renderer,
      };
    }
  },
};
