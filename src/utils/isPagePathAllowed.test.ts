import { isPagePathAllowed } from "./isPagePathAllowed.js";

describe("isPagePathAllowed", () => {
  describe("default behavior with empty or undefined lists", () => {
    it("returns true when allowList and denyList are undefined", () => {
      expect(isPagePathAllowed("pages/main/sidebar.html")).toBe(true);
      expect(isPagePathAllowed("sidebar.html")).toBe(true);
    });

    it("returns true when allowList and denyList are empty arrays", () => {
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          allowList: [],
          denyList: [],
        }),
      ).toBe(true);
      expect(
        isPagePathAllowed("sidebar.html", {
          allowList: [],
          denyList: [],
        }),
      ).toBe(true);
    });

    it("returns true with positional arguments when lists are empty", () => {
      expect(isPagePathAllowed("pages/main/sidebar.html", [], [])).toBe(true);
      expect(isPagePathAllowed("sidebar.html", [], [])).toBe(true);
    });
  });

  describe("denyList filtering", () => {
    it("denies page when specified as pages/main/sidebar.html", () => {
      const denyList = ["pages/main/sidebar.html"];

      expect(isPagePathAllowed("pages/main/sidebar.html", { denyList })).toBe(
        false,
      );
      expect(
        isPagePathAllowed("sidebar.html", { denyList, groupId: "main" }),
      ).toBe(false);
      expect(isPagePathAllowed("sidebar.html", { denyList })).toBe(false);
      expect(isPagePathAllowed("/pages/main/sidebar.html", { denyList })).toBe(
        false,
      );

      // Other pages should still be allowed
      expect(isPagePathAllowed("pages/main/index.html", { denyList })).toBe(
        true,
      );
      expect(isPagePathAllowed("index.html", { denyList })).toBe(true);
      expect(isPagePathAllowed("posts/post1.md", { denyList })).toBe(true);
    });

    it("handles leading and trailing slashes in denyList patterns", () => {
      expect(
        isPagePathAllowed("sidebar.html", {
          denyList: ["/pages/main/sidebar.html/"],
        }),
      ).toBe(false);
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          denyList: ["/pages/main/sidebar.html"],
        }),
      ).toBe(false);
    });

    it("denies by bare filename in denyList", () => {
      const denyList = ["sidebar.html"];

      expect(isPagePathAllowed("pages/main/sidebar.html", { denyList })).toBe(
        false,
      );
      expect(isPagePathAllowed("sidebar.html", { denyList })).toBe(false);
      expect(isPagePathAllowed("pages/custom/sidebar.html", { denyList })).toBe(
        false,
      );

      expect(isPagePathAllowed("pages/main/index.html", { denyList })).toBe(
        true,
      );
    });

    it("denies directory prefixes in denyList", () => {
      const denyList = ["pages/main/drafts"];

      expect(isPagePathAllowed("pages/main/drafts/post.md", { denyList })).toBe(
        false,
      );
      expect(
        isPagePathAllowed("drafts/post.md", { denyList, groupId: "main" }),
      ).toBe(false);
      expect(isPagePathAllowed("drafts/sub/post.md", { denyList })).toBe(false);

      expect(isPagePathAllowed("pages/main/posts/post.md", { denyList })).toBe(
        true,
      );
    });

    it("denies directory names anywhere with trailing slash", () => {
      const denyList = ["drafts/"];

      expect(isPagePathAllowed("pages/main/drafts/post.md", { denyList })).toBe(
        false,
      );
      expect(isPagePathAllowed("drafts/post.md", { denyList })).toBe(false);
      expect(isPagePathAllowed("pages/main/posts/post.md", { denyList })).toBe(
        true,
      );
    });

    it("supports lowercase denylist option name", () => {
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          denylist: ["pages/main/sidebar.html"],
        }),
      ).toBe(false);
    });

    it("denies extensionless routes like /main/memory against MEMORY.md and case-insensitively", () => {
      const denyList = ["/main/memory"];

      expect(isPagePathAllowed("MEMORY.md", { denyList })).toBe(false);
      expect(
        isPagePathAllowed("MEMORY.md", { denyList, groupId: "main" }),
      ).toBe(false);
      expect(isPagePathAllowed("pages/main/MEMORY.md", { denyList })).toBe(
        false,
      );
      expect(isPagePathAllowed("main/MEMORY.md", { denyList })).toBe(false);
      expect(isPagePathAllowed("main/memory", { denyList })).toBe(false);
      expect(isPagePathAllowed("memory.md", { denyList })).toBe(false);

      // Other pages remain allowed
      expect(isPagePathAllowed("index.html", { denyList })).toBe(true);
      expect(isPagePathAllowed("pages/main/index.html", { denyList })).toBe(
        true,
      );
    });

    it("denies when pattern uses different casing or extensions", () => {
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          denyList: ["SIDEBAR.HTML"],
        }),
      ).toBe(false);
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          denyList: ["sidebar"],
        }),
      ).toBe(false);
      expect(
        isPagePathAllowed("pages/main/sidebar.html", {
          denyList: ["pages/main/sidebar"],
        }),
      ).toBe(false);
    });
  });

  describe("allowList filtering", () => {
    it("allows only matching pages when allowList is provided", () => {
      const allowList = ["posts", "index.html"];

      expect(
        isPagePathAllowed("pages/main/posts/post1.md", { allowList }),
      ).toBe(true);
      expect(isPagePathAllowed("posts/post1.md", { allowList })).toBe(true);
      expect(isPagePathAllowed("index.html", { allowList })).toBe(true);
      expect(isPagePathAllowed("pages/main/index.html", { allowList })).toBe(
        true,
      );

      // Not in allowList
      expect(isPagePathAllowed("pages/main/sidebar.html", { allowList })).toBe(
        false,
      );
      expect(isPagePathAllowed("sidebar.html", { allowList })).toBe(false);
      expect(isPagePathAllowed("about.md", { allowList })).toBe(false);
    });

    it("supports lowercase allowlist option name", () => {
      expect(
        isPagePathAllowed("posts/post1.md", {
          allowlist: ["posts"],
        }),
      ).toBe(true);
      expect(
        isPagePathAllowed("sidebar.html", {
          allowlist: ["posts"],
        }),
      ).toBe(false);
    });
  });

  describe("combined allowList and denyList", () => {
    it("denyList takes precedence over allowList", () => {
      const allowList = ["posts"];
      const denyList = ["posts/secret.md"];

      expect(
        isPagePathAllowed("posts/public.md", { allowList, denyList }),
      ).toBe(true);
      expect(
        isPagePathAllowed("posts/secret.md", { allowList, denyList }),
      ).toBe(false);
      expect(isPagePathAllowed("sidebar.html", { allowList, denyList })).toBe(
        false,
      );
    });
  });

  describe("normalized groupId handling", () => {
    it("handles br: prefix in groupId", () => {
      expect(
        isPagePathAllowed("sidebar.html", {
          denyList: ["pages/main/sidebar.html"],
          groupId: "br:main",
        }),
      ).toBe(false);
    });

    it("handles br- prefix in groupId", () => {
      expect(
        isPagePathAllowed("sidebar.html", {
          denyList: ["pages/main/sidebar.html"],
          groupId: "br-main",
        }),
      ).toBe(false);
    });
  });

  describe("invalid inputs", () => {
    it("returns false for empty or non-string paths", () => {
      expect(isPagePathAllowed("")).toBe(false);
      expect(isPagePathAllowed(null as any)).toBe(false);
      expect(isPagePathAllowed(undefined as any)).toBe(false);
    });
  });
});
