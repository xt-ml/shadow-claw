import {
  createFrontmatterDetailsElement,
  createFrontmatterElement,
  PostFrontmatter,
  renderFrontmatterMarkup,
  splitFrontmatter,
} from "./frontmatter.mjs";

describe("frontmatter utilities", () => {
  it("parses YAML frontmatter content with gray-matter", () => {
    const markdown = [
      "---",
      'title: "On Developing Loops"',
      'slug: "on-developing-loops"',
      "---",
      "# Heading",
    ].join("\n");

    const parsed = splitFrontmatter(markdown);

    expect(parsed.data).toEqual({
      title: "On Developing Loops",
      slug: "on-developing-loops",
    });
    expect(parsed.content.trim()).toBe("# Heading");
  });

  it("handles markdown with no frontmatter or empty input in splitFrontmatter", () => {
    const emptyParsed = splitFrontmatter("");
    expect(emptyParsed.data).toEqual({});
    expect(emptyParsed.content).toBe("");

    const plainParsed = splitFrontmatter("Just plain markdown");
    expect(plainParsed.data).toEqual({});
    expect(plainParsed.content).toBe("Just plain markdown");
  });

  describe("createFrontmatterElement", () => {
    it("renders header with title and updated timestamp", () => {
      const element = createFrontmatterElement(
        {
          title: "My Article",
          updated: "2026-03-15T10:00:00Z",
          created: "2026-01-01T10:00:00Z",
        } as PostFrontmatter,
        document,
      );

      expect(element.tagName.toLowerCase()).toBe("header");
      expect(element.getAttribute("class")).toBe("markdown-frontmatter");

      const title = element.querySelector("h1");
      expect(title?.textContent).toBe("My Article");
      expect(title?.getAttribute("class")).toBe("markdown-frontmatter__title");

      const time = element.querySelector("time");
      expect(time?.getAttribute("datetime")).toBe("2026-03-15T10:00:00Z");
      expect(time?.textContent).toBeDefined();
    });

    it("falls back to created timestamp when updated is missing", () => {
      const element = createFrontmatterElement(
        {
          created: "2026-01-01T10:00:00Z",
        } as PostFrontmatter,
        document,
      );

      const title = element.querySelector("h1");
      expect(title).toBeNull();

      const time = element.querySelector("time");
      expect(time?.getAttribute("datetime")).toBe("2026-01-01T10:00:00Z");
    });

    it("renders empty header container when no title or timestamp is provided", () => {
      const element = createFrontmatterElement({} as PostFrontmatter, document);
      expect(element.children.length).toBe(0);
    });
  });

  it("builds frontmatter DOM element using createElement semantics", () => {
    const element = createFrontmatterDetailsElement(
      { title: "Post", slug: "post" } as PostFrontmatter,
      document,
    );

    expect(element.tagName.toLowerCase()).toBe("section");
    expect(element.getAttribute("class")).toBe("markdown-frontmatter");
    expect(element.getAttribute("data-frontmatter")).toContain(
      '"title": "Post"',
    );

    const summary = element.querySelector("summary");
    expect(summary?.textContent).toBe("Frontmatter");

    const code = element.querySelector("code");
    expect(code?.textContent).toContain('"slug": "post"');
  });

  it("throws in createFrontmatterDetailsElement if documentInstance is invalid", () => {
    expect(() =>
      createFrontmatterDetailsElement({} as PostFrontmatter, null as any),
    ).toThrow("A valid documentInstance is required");

    expect(() =>
      createFrontmatterDetailsElement({} as PostFrontmatter, {} as any),
    ).toThrow("A valid documentInstance is required");
  });

  it("serializes markup in browser via DOM outerHTML", () => {
    const html = renderFrontmatterMarkup(
      { title: "Browser Title" } as PostFrontmatter,
      createFrontmatterDetailsElement,
      {
        documentInstance: document,
      },
    );

    expect(html).toContain("markdown-frontmatter");
    expect(html).toContain("data-frontmatter=");
    expect(html).toContain("Frontmatter");
    expect(html).toContain("&quot;title&quot;: &quot;Browser Title&quot;");
  });

  it("uses global document by default in renderFrontmatterMarkup", () => {
    const html = renderFrontmatterMarkup(
      { title: "Default Document" } as PostFrontmatter,
      createFrontmatterElement,
    );
    expect(html).toContain("markdown-frontmatter");
    expect(html).toContain("Default Document");
  });

  it("falls back to XMLSerializer when outerHTML is not available", () => {
    const customRenderer = (_data: any, doc: Document) => {
      const el = doc.createElement("section");
      el.setAttribute("class", "xml-fallback");
      Object.defineProperty(el, "outerHTML", {
        value: undefined,
        configurable: true,
      });
      return el;
    };

    const html = renderFrontmatterMarkup(
      {} as PostFrontmatter,
      customRenderer,
      { documentInstance: document },
    );
    expect(html).toContain('class="xml-fallback"');
  });

  it("throws when no serializer is available", () => {
    const customRenderer = () => {
      const el = { outerHTML: undefined };
      return el as any;
    };

    const fakeDoc = {
      createElement: () => ({}),
      defaultView: {},
    } as any;

    const originalXml = (globalThis as any).XMLSerializer;
    try {
      delete (globalThis as any).XMLSerializer;
      expect(() =>
        renderFrontmatterMarkup({} as PostFrontmatter, customRenderer, {
          documentInstance: fakeDoc,
        }),
      ).toThrow("No serializer available for frontmatter DOM element.");
    } finally {
      (globalThis as any).XMLSerializer = originalXml;
    }
  });

  it("serializes markup via injected serializer for xmldom-style usage", () => {
    const fakeDocument = {
      createTextNode(text: string) {
        return {
          nodeType: 3,
          textContent: text,
        } as any;
      },
      createElement(tagName: string) {
        const node: any = {
          tagName,
          attributes: {},
          children: [],
          _text: "",
          setAttribute(name: string, value: string) {
            this.attributes[name] = value;
          },
          appendChild(child: any) {
            this.children.push(child);
          },
          set textContent(value: string) {
            this._text = value;
          },
          get textContent() {
            return this._text;
          },
        };

        return node;
      },
    } as unknown as Document;

    const serializeNode = (node: any): string => {
      if (node?.nodeType === 3) {
        return String(node.textContent || "");
      }
      const attrs = Object.entries(node.attributes || {})
        .map(([key, value]) => ` ${key}="${String(value)}"`)
        .join("");
      const text = node._text || "";
      const children = (node.children || [])
        .map((child: any) => serializeNode(child))
        .join("");
      return `<${node.tagName}${attrs}>${text}${children}</${node.tagName}>`;
    };

    const html = renderFrontmatterMarkup(
      { title: "Node Title" } as PostFrontmatter,
      createFrontmatterDetailsElement,
      { documentInstance: fakeDocument, serializeNode },
    );

    expect(html).toContain("<section");
    expect(html).toContain("data-frontmatter=");
    expect(html).toContain("Frontmatter");
    expect(html).toContain('"title": "Node Title"');
  });
});
