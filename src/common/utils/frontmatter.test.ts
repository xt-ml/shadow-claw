import {
  createFrontmatterDetailsElement,
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
