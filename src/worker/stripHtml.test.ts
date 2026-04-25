import { stripHtml } from "./stripHtml.js";

describe("stripHtml", () => {
  describe("basic tag stripping", () => {
    it("should remove simple HTML tags", () => {
      expect(stripHtml("<p>Hello</p>")).toBe("Hello");
    });

    it("should remove nested tags", () => {
      expect(stripHtml("<div><p>Hello <b>world</b></p></div>")).toBe(
        "Hello world",
      );
    });

    it("should return plain text unchanged", () => {
      expect(stripHtml("Hello world")).toBe("Hello world");
    });

    it("should return empty string for empty input", () => {
      expect(stripHtml("")).toBe("");
    });
  });

  describe("script, style, and noisy tag removal", () => {
    it("should remove script tags and their content", () => {
      expect(
        stripHtml("<p>Hello</p><script>alert(1)</script><p>World</p>"),
      ).toBe("Hello World");
    });

    it("should remove style tags and their content", () => {
      expect(stripHtml("<style>body { color: red; }</style><p>Hello</p>")).toBe(
        "Hello",
      );
    });

    it("should remove noscript tags and their content", () => {
      expect(stripHtml("<noscript>Enable JS</noscript><p>Content</p>")).toBe(
        "Content",
      );
    });

    it("should remove svg tags and their content", () => {
      expect(
        stripHtml(
          '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg><p>Text</p>',
        ),
      ).toBe("Text");
    });

    it("should remove nav tags and their content", () => {
      expect(
        stripHtml("<nav><a href='/'>Home</a></nav><p>Main content</p>"),
      ).toBe("Main content");
    });

    it("should remove footer tags and their content", () => {
      expect(stripHtml("<p>Content</p><footer>© 2024</footer>")).toBe(
        "Content",
      );
    });

    it("should remove header tags and their content", () => {
      expect(stripHtml("<header><h1>Site Title</h1></header><p>Body</p>")).toBe(
        "Body",
      );
    });

    it("should remove aside tags and their content", () => {
      expect(stripHtml("<aside>Sidebar</aside><p>Main</p>")).toBe("Main");
    });

    it("should remove head tags and their content", () => {
      expect(
        stripHtml("<head><title>Page</title></head><body><p>Hello</p></body>"),
      ).toBe("Hello");
    });
  });

  describe("HTML comment removal", () => {
    it("should remove HTML comments", () => {
      expect(stripHtml("<!-- comment --><p>Text</p>")).toBe("Text");
    });

    it("should remove multi-line comments", () => {
      expect(stripHtml("<!-- \n multi-line \n comment \n --><p>Text</p>")).toBe(
        "Text",
      );
    });
  });

  describe("entity decoding", () => {
    it("should decode &amp;", () => {
      expect(stripHtml("<p>A &amp; B</p>")).toBe("A & B");
    });

    it("should decode &lt; and &gt;", () => {
      expect(stripHtml("<p>&lt;tag&gt;</p>")).toBe("<tag>");
    });

    it("should decode &quot;", () => {
      expect(stripHtml("<p>&quot;hello&quot;</p>")).toBe('"hello"');
    });

    it("should decode &#39;", () => {
      expect(stripHtml("<p>it&#39;s</p>")).toBe("it's");
    });

    it("should decode &nbsp;", () => {
      expect(stripHtml("<p>hello&nbsp;world</p>")).toBe("hello world");
    });

    it("should remove numeric character references", () => {
      expect(stripHtml("<p>&#8212;</p>")).toBe("");
    });
  });

  describe("whitespace normalization", () => {
    it("should collapse multiple spaces into one", () => {
      expect(stripHtml("<p>Hello     world</p>")).toBe("Hello world");
    });

    it("should collapse multiple newlines", () => {
      expect(stripHtml("<p>Hello</p>\n\n\n<p>World</p>")).toBe("Hello\n World");
    });

    it("should trim leading and trailing whitespace", () => {
      expect(stripHtml("  <p>Hello</p>  ")).toBe("Hello");
    });
  });

  describe("intelligent content extraction", () => {
    it("should extract content from <main> tag when present", () => {
      const html = `
        <header><h1>Nav</h1></header>
        <main><p>Important content</p></main>
        <footer>Footer</footer>
      `;
      expect(stripHtml(html)).toBe("Important content");
    });

    it("should extract content from <article> tag when no <main>", () => {
      const html = `
        <nav>Navigation</nav>
        <article><h2>Title</h2><p>Body text</p></article>
        <aside>Sidebar</aside>
      `;
      expect(stripHtml(html)).toBe("Title Body text");
    });

    it("should prefer <main> over <article>", () => {
      const html = `
        <main><p>Main content</p></main>
        <article><p>Article content</p></article>
      `;
      expect(stripHtml(html)).toBe("Main content");
    });

    it("should fall back to full body when no <main> or <article>", () => {
      const html = `<div><p>Some content</p></div>`;
      expect(stripHtml(html)).toBe("Some content");
    });

    it("should still strip noisy tags inside <main>", () => {
      const html = `
        <main>
          <nav><a href="/">Home</a></nav>
          <p>Real content</p>
          <aside>Related links</aside>
        </main>
      `;
      expect(stripHtml(html)).toBe("Real content");
    });
  });

  describe("real-world HTML", () => {
    it("should handle a realistic page structure", () => {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><title>Test</title><style>body{margin:0}</style></head>
        <body>
          <header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
          <main>
            <h1>Welcome</h1>
            <p>This is the main content of the page.</p>
            <script>console.log("tracking");</script>
          </main>
          <footer><p>Copyright 2024</p></footer>
        </body>
        </html>
      `;
      const result = stripHtml(html);
      expect(result).toContain("Welcome");
      expect(result).toContain("main content");
      expect(result).not.toContain("tracking");
      expect(result).not.toContain("Home");
      expect(result).not.toContain("Copyright");
    });

    it("should handle tags with attributes", () => {
      expect(
        stripHtml(
          '<main class="content" id="main"><p data-x="1">Hello</p></main>',
        ),
      ).toBe("Hello");
    });
  });
});
