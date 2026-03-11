export default {
  testEnvironment: "jsdom",
  transform: {},
  testPathIgnorePatterns: ["/dist/", "/e2e/"],
  moduleNameMapper: {
    "^signal-polyfill$": "<rootDir>/src/__mocks__/signal-polyfill.mjs",
    // Bare specifiers (used by other modules or older patterns)
    "^@isomorphic-git/lightning-fs$":
      "<rootDir>/src/git/__mocks__/lightningFs.mjs",
    "^isomorphic-git$": "<rootDir>/src/git/__mocks__/isomorphicGit.mjs",
    "^isomorphic-git/http/web$": "<rootDir>/src/git/__mocks__/httpWeb.mjs",
    "^buffer$": "<rootDir>/src/git/__mocks__/buffer.mjs",
    // CDN URLs used by dynamic import() in git.mjs (for worker compatibility)
    "^https://unpkg\\.com/@isomorphic-git/lightning-fs.+$":
      "<rootDir>/src/git/__mocks__/lightningFs.mjs",
    "^https://unpkg\\.com/isomorphic-git@[^/]+/index\\.umd\\.min\\.js$":
      "<rootDir>/src/git/__mocks__/isomorphicGit.mjs",
    "^https://unpkg\\.com/isomorphic-git@[^/]+/http/web/index\\.js$":
      "<rootDir>/src/git/__mocks__/httpWeb.mjs",
    "^https://cdn\\.jsdelivr\\.net/npm/buffer.+$":
      "<rootDir>/src/git/__mocks__/buffer.mjs",
    "^zip$": "<rootDir>/src/__mocks__/zip.mjs",
    "^jszip$": "<rootDir>/src/__mocks__/jszip.mjs",
    "^dompurify$": "<rootDir>/src/__mocks__/dompurify.mjs",
    "^marked$": "<rootDir>/src/__mocks__/marked.mjs",
    "^highlight\\.js$": "<rootDir>/src/__mocks__/highlightjs.mjs",
    "^pdfjs-dist$": "<rootDir>/src/__mocks__/pdfjs-dist.mjs",
    "^quill$": "<rootDir>/src/__mocks__/quill.mjs",
  },
};
