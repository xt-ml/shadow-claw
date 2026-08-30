import { rewriteWorkspacePreviewHtml } from "./rewriteWorkspacePreviewHtml.js";

describe("rewriteWorkspacePreviewHtml", () => {
  const routeDir = "/shadow-claw/files/br:main/docs";
  const groupId = "br:main";
  const origin = "http://localhost:8888";

  it("returns unchanged HTML for empty inputs", () => {
    expect(
      rewriteWorkspacePreviewHtml(
        "",
        "docs/index.html",
        routeDir,
        groupId,
        origin,
      ),
    ).toBe("");
  });

  it("rewrites image src attributes to resolved pathname", () => {
    const html = '<img src="images/logo.png" alt="logo">';
    const rewritten = rewriteWorkspacePreviewHtml(
      html,
      "docs/index.html",
      routeDir,
      groupId,
      origin,
    );
    expect(rewritten).toContain(
      'src="/shadow-claw/files/br:main/images/logo.png"',
    );
  });

  it("preserves external hrefs without rewriting them to local app routes", () => {
    const html = '<a href="https://example.com/docs">External</a>';
    const rewritten = rewriteWorkspacePreviewHtml(
      html,
      "docs/index.html",
      routeDir,
      groupId,
      origin,
    );
    expect(rewritten).toContain('href="https://example.com/docs"');
  });

  it("rewrites relative markdown links to subpath-prefixed workspace routes", () => {
    const html =
      '<p><a href="01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg">01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg</a></p>';
    const rewritten = rewriteWorkspacePreviewHtml(
      html,
      "index.md",
      "/shadow-claw/files/br:main/",
      groupId,
      origin,
    );
    expect(rewritten).toContain(
      'href="/shadow-claw/files/br:main/01M1A1R4Y708YJNPGV2NHQKYF7-IMG_0233.jpeg"',
    );
  });
});
