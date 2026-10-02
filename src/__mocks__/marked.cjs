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

let activeTokenizer = {};

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

    const htmlBlocks = [];
    if (typeof activeTokenizer.html === "function") {
      let remaining = res;
      let newRes = "";
      while (remaining.length > 0) {
        const token = activeTokenizer.html(remaining);
        if (token && token.block) {
          const index = htmlBlocks.length;
          htmlBlocks.push(token.text || token.raw);
          newRes += `\n\n@@MOCK_HTML_BLOCK_${index}@@\n\n`;
          remaining = remaining.slice(token.raw.length);
        } else {
          const nextNewline = remaining.indexOf("\n");
          if (nextNewline === -1) {
            newRes += remaining;
            break;
          } else {
            newRes += remaining.slice(0, nextNewline + 1);
            remaining = remaining.slice(nextNewline + 1);
          }
        }
      }
      res = newRes;
    }

    res = res.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
      return renderHeadingBlock(text, hashes.length);
    });

    // Handle images: ![alt](url) or ![alt](<url>)
    res = res.replace(/!\[([^\]]*)\]\((?:<([^>]+)>|([^ )\t]+))(?:\s+["']([^"']*)["'])?\)/g, (_, alt, url1, url2, title) => {
      const src = (url1 || url2 || "").replace(/ /g, "%20");
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr}>`;
    });

    // Handle links: [text](url) or [text](<url>)
    res = res.replace(/\[([^\]]+)\]\((?:<([^>]+)>|([^ )\t]+))(?:\s+["']([^"']*)["'])?\)/g, (_, text, url1, url2, title) => {
      const href = (url1 || url2 || "").replace(/ /g, "%20");
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
    });

    res = res.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    res = res.replace(/\n\n+/g, "</p><p>");

    if (options?.breaks) {
      res = res.replace(/\n/g, "<br>");
    }

    if (val.includes("\n\n") || !val.includes("\n")) {
      res = `<p>${res}</p>`;
    }

    res = res.replace(/@@MOCK_CODE_BLOCK_(\d+)@@/g, (_, index) => {
      return codeBlocks[Number(index)] || "";
    });

    res = res.replace(/<p>\s*@@MOCK_HTML_BLOCK_(\d+)@@\s*<\/p>/g, (_, index) => {
      return htmlBlocks[Number(index)] || "";
    });

    res = res.replace(/@@MOCK_HTML_BLOCK_(\d+)@@/g, (_, index) => {
      return htmlBlocks[Number(index)] || "";
    });

    res = res.replace(/<p>\s*<\/p>/g, "");

    return res;
  },
  use: (options) => {
    if (options && options.renderer) {
      activeRenderer = {
        ...activeRenderer,
        ...options.renderer,
      };
    }
    if (options && options.tokenizer) {
      activeTokenizer = {
        ...activeTokenizer,
        ...options.tokenizer,
      };
    }
  },
};
