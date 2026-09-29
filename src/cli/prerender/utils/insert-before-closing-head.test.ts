import { describe, it, expect } from "@jest/globals";
import {
  findClosingHeadIndex,
  insertBeforeClosingHead,
} from "./insert-before-closing-head.js";

describe("insertBeforeClosingHead", () => {
  it("inserts content before </head> tag when present", () => {
    const html =
      "<!doctype html><html><head><title>Test</title></head><body></body></html>";
    const tag = '<script id="test">true</script>';
    const result = insertBeforeClosingHead(html, tag);
    expect(result).toContain(`${tag}\n</head>`);
  });

  it("prepends content when </head> tag is missing", () => {
    const html = "<!doctype html><html><body><h1>No head</h1></body></html>";
    const tag = '<meta name="inserted" content="true" />';
    const result = insertBeforeClosingHead(html, tag);
    expect(result.startsWith(`${tag}\n`)).toBe(true);
  });

  it("targets the first outer </head> tag when nested templates have their own head", () => {
    const html =
      '<!doctype html><html><head><title>Outer</title></head><body><template shadowrootmode="open"><head><title>Inner</title></head></template></body></html>';
    const tag = '<script id="outer-test">true</script>';
    const result = insertBeforeClosingHead(html, tag);
    const outerIndex = result.indexOf(tag);
    const firstHeadClose = result.indexOf("</head>");
    const secondHeadClose = result.lastIndexOf("</head>");
    expect(outerIndex).toBeLessThan(firstHeadClose);
    expect(firstHeadClose).toBeLessThan(secondHeadClose);
  });

  it("ignores </head> string literals inside inlined <script> blocks", () => {
    const html =
      '<!doctype html><html><head><title>Outer</title><script>var x = "<head></head>";</script></head><body></body></html>';
    const tag = '<link rel="stylesheet" href="theme.css" />';
    const result = insertBeforeClosingHead(html, tag);
    expect(result).toContain(`${tag}\n</head><body>`);
    expect(findClosingHeadIndex(html)).toBe(html.lastIndexOf("</head>"));
  });

  it("ignores </head> inside comments and style blocks", () => {
    const html =
      "<!doctype html><html><head><!-- </head> --><style>/* </head> */</style></head><body></body></html>";
    const tag = '<link rel="stylesheet" href="theme.css" />';
    const result = insertBeforeClosingHead(html, tag);
    expect(result).toContain(`${tag}\n</head><body>`);
    expect(findClosingHeadIndex(html)).toBe(html.lastIndexOf("</head>"));
  });
});
