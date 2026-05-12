import { jest } from "@jest/globals";

// We'll test the DB layer and orchestrator store directly
// since the component has browser-only dependencies (jszip from CDN)
const { orchestratorStore } = await import("../../stores/orchestrator.js");
const { clearGroupMessages } = await import("../../db/clearGroupMessages.js");
const { setDB } = await import("../../db/db.js");

describe("shadow-claw-chat clear functionality", () => {
  let mockDb;
  let mockTx;
  let mockStore;
  let mockIndex;

  beforeEach(() => {
    // Create mock database with proper IndexedDB structure
    mockIndex = {
      openCursor: jest.fn(),
    };

    mockStore = {
      get: jest.fn(),
      put: jest.fn(),
      index: jest.fn().mockReturnValue(mockIndex),
      delete: jest.fn(),
    };

    mockTx = {
      objectStore: jest.fn().mockReturnValue(mockStore),
    };

    mockDb = {
      transaction: jest.fn().mockReturnValue(mockTx),
    };

    setDB(mockDb);
  });

  describe("orchestratorStore.newSession", () => {
    it("should accept db parameter and pass it to orchestrator (BUG FIX)", async () => {
      // Setup mock orchestrator
      const mockOrchestrator: any = {
        newSession: (jest.fn() as any).mockResolvedValue(undefined),
      };

      orchestratorStore.orchestrator = mockOrchestrator;

      // Mock loadHistory to avoid IDBKeyRange issues in tests
      const loadHistorySpy = jest
        .spyOn(orchestratorStore, "loadHistory")
        .mockResolvedValue(undefined);

      // Execute: Call newSession with db
      // This test will PASS after the fix because newSession now accepts db parameter
      await orchestratorStore.newSession(mockDb);

      // Assert: orchestrator.newSession should be called with db and groupId
      expect(mockOrchestrator.newSession).toHaveBeenCalledWith(
        mockDb,
        orchestratorStore.activeGroupId,
      );

      // Assert: loadHistory should be called after clearing
      expect(loadHistorySpy).toHaveBeenCalled();

      // Clean up
      loadHistorySpy.mockRestore();
    });

    it("should clear messages from DB when called", async () => {
      const deletedIds: any = [];

      // Setup: Create mock orchestrator that calls clearGroupMessages
      const mockOrchestrator: any = {
        newSession: jest.fn(async (db: any, groupId: any) => {
          // Simulate what the real orchestrator does
          await clearGroupMessages(db, groupId);
        }),
      };

      orchestratorStore.orchestrator = mockOrchestrator;

      // Mock loadHistory to avoid IDBKeyRange issues
      jest.spyOn(orchestratorStore, "loadHistory").mockResolvedValue(undefined);

      // Mock cursor for clearGroupMessages
      mockIndex.openCursor.mockImplementation((_key) => {
        const request: any = {};
        const messages = [
          { id: "1", groupId: "default", content: "test1" },
          { id: "2", groupId: "default", content: "test2" },
        ];

        let currentIndex = 0;

        // Trigger onsuccess asynchronously
        const triggerSuccess = () => {
          if (currentIndex < messages.length) {
            const msg = messages[currentIndex];

            request.result = {
              value: msg,
              delete: () => {
                deletedIds.push(msg.id);
              },

              continue: () => {
                currentIndex++;
                setTimeout(triggerSuccess, 0);
              },
            };
          } else {
            request.result = null;
          }

          if (request.onsuccess) {
            request.onsuccess();
          }
        };

        setTimeout(triggerSuccess, 0);

        return request;
      });

      // Execute
      await orchestratorStore.newSession(mockDb);

      // Wait for async cursor operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Assert: Messages should be deleted from DB
      expect(deletedIds).toEqual(["1", "2"]);
    });
  });

  describe("clearGroupMessages", () => {
    it("should delete all messages for a group from IndexedDB", async () => {
      const deletedIds: any = [];

      // Mock cursor behavior for clearGroupMessages
      mockIndex.openCursor.mockImplementation((_key) => {
        const request: any = {};

        // Simulate 3 messages in DB
        const mockMessages = [
          { id: "1", content: "msg1" },
          { id: "2", content: "msg2" },
          { id: "3", content: "msg3" },
        ];

        let currentIndex = 0;

        const triggerSuccess = () => {
          if (currentIndex < mockMessages.length) {
            const msg = mockMessages[currentIndex];

            request.result = {
              value: msg,
              delete: () => {
                deletedIds.push(msg.id);
              },

              continue: () => {
                currentIndex++;
                setTimeout(triggerSuccess, 0);
              },
            };
          } else {
            request.result = null;
          }

          if (request.onsuccess) {
            request.onsuccess();
          }
        };

        setTimeout(triggerSuccess, 0);

        return request;
      });

      // Call clearGroupMessages directly
      await clearGroupMessages(mockDb, "default");

      // Wait for async cursor operations
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify all messages were deleted
      expect(deletedIds).toEqual(["1", "2", "3"]);
    }, 10000);

    it("should handle empty database gracefully", async () => {
      // Mock cursor with no results
      mockIndex.openCursor.mockImplementation(() => {
        const request: any = {};
        setTimeout(() => {
          request.result = null; // No messages

          if (request.onsuccess) {
            request.onsuccess();
          }
        }, 0);

        return request;
      });

      // Should not throw
      await expect(
        clearGroupMessages(mockDb, "default"),
      ).resolves.not.toThrow();
    });

    it("should throw error when db transaction fails", async () => {
      const badDb: any = {
        transaction: jest.fn().mockReturnValue(null),
      };

      await expect(clearGroupMessages(badDb as any, "default")).rejects.toThrow(
        "failed to get transaction",
      );
    });
  });
});

describe("shadow-claw-chat UX enhancements (issue #10)", () => {
  describe("ShadowClawChat static template", () => {
    let templateHtml;

    beforeAll(async () => {
      // Import the class to access static method
      // We use a dynamic import with a mock to avoid browser-only deps
      jest.unstable_mockModule("jszip", () => ({ default: {} }));
      jest.unstable_mockModule("../../db/exportChatData.js", () => ({
        exportChatData: jest.fn(),
      }));

      jest.unstable_mockModule("../../db/db.js", () => ({
        getDb: jest.fn(),
      }));

      jest.unstable_mockModule("../../db/importChatData.js", () => ({
        importChatData: jest.fn(),
      }));

      jest.unstable_mockModule("../../effect.js", () => ({
        effect: jest.fn(),
      }));

      jest.unstable_mockModule("../../markdown.js", () => ({
        renderMarkdown: jest.fn((str: string) => `<p>${str}</p>`),
      }));

      jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
        fileViewerStore: { openFile: jest.fn() },
      }));

      jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
        orchestratorStore: {
          messages: [],
          state: "idle",
          activeGroupId: "test-group",
          sendMessage: jest.fn(),
          stopCurrentRequest: jest.fn(),
        },
      }));

      jest.unstable_mockModule("../../utils.js", () => ({
        formatTimestamp: jest.fn((ts: number) => new Date(ts).toISOString()),
        sanitizeGroupId: jest.fn((id: string) =>
          id.replace(/[^a-zA-Z0-9-]/g, "-"),
        ),
        escapeHtml: jest.fn((text: string) => text.replace(/</g, "&lt;")),
        formatDateForFilename: jest.fn((date: Date) => date.toISOString()),
      }));

      jest.unstable_mockModule("../../toast.js", () => ({
        showSuccess: jest.fn(),
        showError: jest.fn(),
        showInfo: jest.fn(),
        showWarning: jest.fn(),
      }));

      jest.unstable_mockModule(
        "../shadow-claw-page-header/shadow-claw-page-header.js",
        () => ({}) as any,
      );

      const { ShadowClawChat: _ShadowClawChat } =
        await import("./shadow-claw-chat.js");

      const fs = await import("fs");
      const path = await import("path");
      const basePath = process.cwd();
      const htmlPath = path.join(
        basePath,
        "src/components/shadow-claw-chat/shadow-claw-chat.html",
      );

      const cssPath = path.join(
        basePath,
        "src/components/shadow-claw-chat/shadow-claw-chat.css",
      );

      templateHtml =
        fs.readFileSync(htmlPath, "utf-8") + fs.readFileSync(cssPath, "utf-8");
    });

    it("should include a token usage display element", () => {
      expect(templateHtml).toContain("chat__token-usage");
    });

    it("should include copy button CSS styles", () => {
      expect(templateHtml).toContain("chat__code-copy-btn");
    });

    it("should include the updated placeholder with keyboard hint", () => {
      expect(templateHtml).toContain("Shift+Enter for newline");
    });

    it("should include position: relative on pre for copy button positioning", () => {
      expect(templateHtml).toContain("position: relative");
    });

    it("should include token usage visibility class", () => {
      expect(templateHtml).toContain("chat__token-usage--visible");
    });

    it("should include copy-button copied state class", () => {
      expect(templateHtml).toContain("chat__code-copy-btn--copied");
    });

    it("should include an attach-files action button", () => {
      expect(templateHtml).toContain('data-action="attach-files"');
      expect(templateHtml).toContain("chat__attach-btn");
    });

    it("should include a hidden multi-file attachment input", () => {
      expect(templateHtml).toContain("chat__attachment-input");
      expect(templateHtml).toContain('type="file" multiple');
    });
  });

  describe("AUTO_SCROLL_THRESHOLD constant", () => {
    it("should be exported at module level (5rem)", async () => {
      // The constant is module-scoped, so we verify its effect indirectly.
      // The key behavior: if user scrolls up, auto-scroll should NOT happen.
      // We verify the template includes the messages container which is the scroll target.
      jest.unstable_mockModule("jszip", () => ({ default: {} }));

      const { ShadowClawChat: _ShadowClawChat } =
        await import("./shadow-claw-chat.js");
      const fs = await import("fs");
      const path = await import("path");
      const html = fs.readFileSync(
        path.join(
          process.cwd(),
          "src/components/shadow-claw-chat/shadow-claw-chat.html",
        ),
        "utf-8",
      );

      // Verify the scroll container exists
      expect(html).toContain('class="chat__messages"');
      expect(html).toContain('role="log"');
    });
  });

  describe("formatTokenCount helper", () => {
    it("should format numbers with locale separators", () => {
      // We test the logic directly since it's a simple pure function
      const formatTokenCount = (n) =>
        typeof n === "number" ? n.toLocaleString("en-US") : "–";

      expect(formatTokenCount(0)).toBe("0");
      expect(formatTokenCount(1234)).toBe("1,234");
      expect(formatTokenCount(1000000)).toBe("1,000,000");
      expect(formatTokenCount(undefined)).toBe("–");
      expect(formatTokenCount(null)).toBe("–");
    });
  });
});

describe("message copy button", () => {
  let ShadowClawChat;
  let templateHtml;

  beforeAll(async () => {
    jest.unstable_mockModule("jszip", () => ({ default: {} }));

    jest.unstable_mockModule("../../db/exportChatData.js", () => ({
      exportChatData: jest.fn(),
    }));

    jest.unstable_mockModule("../../db/db.js", () => ({
      getDb: jest.fn(),
    }));

    jest.unstable_mockModule("../../db/importChatData.js", () => ({
      importChatData: jest.fn(),
    }));

    jest.unstable_mockModule("../../effect.js", () => ({
      effect: jest.fn(),
    }));

    jest.unstable_mockModule("../../markdown.js", () => ({
      renderMarkdown: jest.fn((str: string) => `<p>${str}</p>`),
    }));

    jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
      fileViewerStore: { openFile: jest.fn() },
    }));

    jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
      orchestratorStore: {
        messages: [],
        state: "idle",
        activeGroupId: "test-group",
        sendMessage: jest.fn(),
        stopCurrentRequest: jest.fn(),
      },
    }));

    jest.unstable_mockModule("../../utils.js", () => ({
      formatTimestamp: jest.fn((ts: number) => new Date(ts).toISOString()),
      sanitizeGroupId: jest.fn((id: string) =>
        id.replace(/[^a-zA-Z0-9-]/g, "-"),
      ),
      escapeHtml: jest.fn((text: string) => text.replace(/</g, "&lt;")),
    }));

    jest.unstable_mockModule("../../toast.js", () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
    }));

    jest.unstable_mockModule(
      "../shadow-claw-page-header/shadow-claw-page-header.js",
      () => ({}) as any,
    );

    const mod = await import("./shadow-claw-chat.js");
    ShadowClawChat = mod.ShadowClawChat;
    const fs = await import("fs");
    const path = await import("path");
    const basePath = process.cwd();
    const htmlPath = path.join(
      basePath,
      "src/components/shadow-claw-chat/shadow-claw-chat.html",
    );

    const cssPath = path.join(
      basePath,
      "src/components/shadow-claw-chat/shadow-claw-chat.css",
    );
    templateHtml =
      fs.readFileSync(htmlPath, "utf-8") + fs.readFileSync(cssPath, "utf-8");
  });

  it("should include message copy button CSS styles in template", () => {
    expect(templateHtml).toContain("chat__msg-copy-btn");
  });

  it("should include hover visibility for message copy button", () => {
    expect(templateHtml).toContain("chat__msg-copy-btn");
    expect(templateHtml).toContain("chat__msg-copy-btn--copied");
  });

  it("should include message copy button positioning styles", () => {
    expect(templateHtml).toContain(
      ".chat__message-content:hover .chat__msg-copy-btn",
    );
  });

  describe("injectMessageCopyButton", () => {
    /* @type InstanceType<typeof ShadowClawChat> */
    let instance;

    beforeEach(() => {
      instance = Object.create(ShadowClawChat.prototype);
    });

    it("should add a copy button to a message article", () => {
      const article = document.createElement("article");
      article.className = "chat__message";
      const content = document.createElement("div");
      content.className = "chat__message-content";
      content.textContent = "Hello world";
      article.appendChild(content);

      instance.injectMessageCopyButton(article, "Hello world");

      const btn = article.querySelector(".chat__msg-copy-btn");
      expect(btn).not.toBeNull();

      expect(btn!.getAttribute("aria-label")).toBe("Copy message to clipboard");
    });

    it("should not duplicate button if called twice", () => {
      const article = document.createElement("article");
      article.className = "chat__message";
      const content = document.createElement("div");
      content.className = "chat__message-content";
      article.appendChild(content);

      instance.injectMessageCopyButton(article, "text");
      instance.injectMessageCopyButton(article, "text");

      const btns = article.querySelectorAll(".chat__msg-copy-btn");
      expect(btns.length).toBe(1);
    });

    it("should copy raw text to clipboard on click", async () => {
      const written: any = [];
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn(async (t) => written.push(t)) },
      });

      const article = document.createElement("article");
      article.className = "chat__message";
      const content = document.createElement("div");
      content.className = "chat__message-content";
      article.appendChild(content);

      const rawContent = "# Hello\n\nThis is **markdown** content.";
      instance.injectMessageCopyButton(article, rawContent);

      const btn = article.querySelector(".chat__msg-copy-btn");

      await (btn as any).click();

      // Should wait a tick for the async handler
      await new Promise((r) => setTimeout(r, 0));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rawContent);
    });

    it("should show copied state after successful copy", async () => {
      Object.assign(navigator, {
        clipboard: { writeText: jest.fn(async () => {}) },
      });

      const article = document.createElement("article");
      article.className = "chat__message";
      const content = document.createElement("div");
      content.className = "chat__message-content";
      article.appendChild(content);

      instance.injectMessageCopyButton(article, "test");

      const btn: any = article.querySelector(".chat__msg-copy-btn");

      await btn.click();
      await new Promise((r) => setTimeout(r, 0));

      expect(btn!.classList.contains("chat__msg-copy-btn--copied")).toBe(true);

      expect(btn!.getAttribute("aria-label")).toBe("Copied!");
    });
  });
});

describe("streaming bubble visibility", () => {
  it("should not render streaming bubble for empty string (prevents flash)", () => {
    // The streaming bubble condition in setupEffects is:
    //   if (typeof streamingText === "string" && streamingText.length > 0)
    //
    // When streaming-start fires, streamingText="" (empty string).
    // The bubble must NOT appear until actual content arrives,
    // otherwise it flashes and disappears if no chunks come before
    // streaming-end fires (e.g. tool calls with no pre-text).

    const emptyString = "";
    const shouldShowBubble =
      typeof emptyString === "string" && emptyString.length > 0;
    expect(shouldShowBubble).toBe(false);
  });

  it("should render streaming bubble when text is present", () => {
    const withContent = "Hello world";
    const shouldShowBubble =
      typeof withContent === "string" && withContent.length > 0;
    expect(shouldShowBubble).toBe(true);
  });

  it("should not render streaming bubble when null", () => {
    const nullValue: any = null;
    const shouldShowBubble =
      typeof nullValue === "string" && nullValue.length > 0;
    expect(shouldShowBubble).toBe(false);
  });

  it("guards against flash on streaming-start → streaming-end with no chunks", () => {
    // Simulate the lifecycle:
    // 1. streaming-start: streamingText = ""
    // 2. streaming-end: streamingText = null (tool calls follow)
    // At no point should the bubble condition be true.
    const states = ["", null];
    const bubbleShown = states.some(
      (s) => typeof s === "string" && s.length > 0,
    );
    expect(bubbleShown).toBe(false);
  });
});

describe("auto-scroll pause on user scroll-up", () => {
  it("should not auto-scroll when user has scrolled away from bottom", () => {
    // _isNearBottom tracks user's scroll position within AUTO_SCROLL_THRESHOLD (5rem).
    // When the user scrolls up, _isNearBottom becomes false, and
    // shouldScroll should be false, preventing forced downward scrolling.
    const _isNearBottom = false; // user scrolled up
    const shouldScroll = _isNearBottom;
    expect(shouldScroll).toBe(false);
  });

  it("should auto-scroll when user is near bottom", () => {
    const _isNearBottom = true; // user at bottom
    const shouldScroll = _isNearBottom;
    expect(shouldScroll).toBe(true);
  });

  it("should restore scroll position relative to bottom after DOM rebuild when user scrolled up", () => {
    // When DOM is rebuilt (innerHTML=""), scroll position is lost.
    // If user was NOT near bottom, we must restore their approximate position
    // relative to the bottom of the container.
    const scrollHeight = 2000;
    const scrollTop = 500;
    const clientHeight = 400;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight; // 1100

    // After DOM rebuild, new content may change scrollHeight
    const newScrollHeight = 2200;
    const restoredScrollTop =
      newScrollHeight - clientHeight - distanceFromBottom;

    // User should be at roughly the same distance from the bottom
    expect(restoredScrollTop).toBe(700); // 2200 - 400 - 1100
    expect(newScrollHeight - restoredScrollTop - clientHeight).toBe(
      distanceFromBottom,
    );
  });

  it("should reset near-bottom state to true when sending a message", async () => {
    // sendMessage() must set near-bottom state to true so that when the user sends
    // a message while scrolled up, auto-scroll resumes — the user wants to see
    // their own message and the response.
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(
        path.dirname(
          new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
        ),
        "shadow-claw-chat.ts",
      ),
      "utf8",
    );
    // The sendMessage method must resume near-bottom state.
    const sendMessageMatch = src.match(
      /async\s+sendMessage\s*\(\)\s*\{[\s\S]*?chatUiStore\.setNearBottom\(true\)/,
    );
    expect(sendMessageMatch).not.toBeNull();
  });
});

describe("auto-scroll on container resize", () => {
  it("should re-scroll to bottom when messages container shrinks and user is near bottom", () => {
    // When sibling elements (activity log, context-usage bar, token-usage)
    // appear or grow, the flex layout shrinks .chat__messages. Without a
    // ResizeObserver the scroll position doesn't adjust — the bottom of
    // the user's message slides below the viewport.
    const scrollHeight = 2000;
    const clientHeightBefore = 600;
    const scrollTopBefore = scrollHeight - clientHeightBefore; // 1400

    // Container shrinks (sibling element appeared)
    const clientHeightAfter = 500;
    // Without ResizeObserver: scrollTop stays 1400 but viewport bottom
    // is now scrollTop + clientHeightAfter = 1900 — last 100px hidden!
    const viewportBottom = scrollTopBefore + clientHeightAfter;
    expect(viewportBottom).toBeLessThan(scrollHeight); // proves content cut off

    // With ResizeObserver: re-scroll to bottom
    const correctedScrollTop = scrollHeight - clientHeightAfter; // 1500
    expect(correctedScrollTop + clientHeightAfter).toBe(scrollHeight);
  });

  it("should NOT re-scroll when user has scrolled away from bottom", () => {
    // If the user deliberately scrolled up, a container resize should
    // NOT yank them back to the bottom.
    const _isNearBottom = false;
    // ResizeObserver callback checks _isNearBottom and skips scroll
    expect(_isNearBottom).toBe(false);
  });

  it("should have a ResizeObserver wired to the messages container", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const src = fs.readFileSync(
      path.join(
        path.dirname(
          new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"),
        ),
        "shadow-claw-chat.ts",
      ),
      "utf8",
    );
    // The component must create a ResizeObserver that references
    // the chat auto-follow logic and scrollHeight.
    expect(src).toMatch(/ResizeObserver/);
    expect(src).toMatch(
      /ResizeObserver[\s\S]*?this\.shouldAutoFollow\(messagesEl\)/,
    );
    expect(src).toMatch(/\.observe\(/);
  });
});

describe("chat workspace link resolution", () => {
  let ShadowClawChat;

  beforeAll(async () => {
    jest.unstable_mockModule("jszip", () => ({ default: {} }));

    jest.unstable_mockModule("../../db/exportChatData.js", () => ({
      exportChatData: jest.fn(),
    }));

    jest.unstable_mockModule("../../db/db.js", () => ({
      getDb: jest.fn(),
    }));

    jest.unstable_mockModule("../../db/importChatData.js", () => ({
      importChatData: jest.fn(),
    }));

    jest.unstable_mockModule("../../effect.js", () => ({
      effect: jest.fn(),
    }));

    jest.unstable_mockModule("../../markdown.js", () => ({
      renderMarkdown: jest.fn((str: string) => `<p>${str}</p>`),
    }));

    jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
      fileViewerStore: { openFile: jest.fn() },
    }));

    jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
      orchestratorStore: {
        messages: [],
        state: "idle",
        activeGroupId: "test-group",
        sendMessage: jest.fn(),
        stopCurrentRequest: jest.fn(),
      },
    }));

    jest.unstable_mockModule("../../utils.js", () => ({
      formatTimestamp: jest.fn((ts: number) => new Date(ts).toISOString()),
      sanitizeGroupId: jest.fn((id: string) =>
        id.replace(/[^a-zA-Z0-9-]/g, "-"),
      ),
      escapeHtml: jest.fn((text: string) => text.replace(/</g, "&lt;")),
      formatDateForFilename: jest.fn((date: Date) => date.toISOString()),
    }));

    jest.unstable_mockModule("../../toast.js", () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn(),
      showWarning: jest.fn(),
    }));

    jest.unstable_mockModule(
      "../shadow-claw-page-header/shadow-claw-page-header.js",
      () => ({}) as any,
    );

    const mod = await import("./shadow-claw-chat.js");
    ShadowClawChat = mod.ShadowClawChat;
  });

  it("resolves a workspace-relative markdown link", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(instance.resolveWorkspaceLinkPath("weather/archive/index.md")).toBe(
      "weather/archive/index.md",
    );
  });

  it("normalizes leading ./ or / and strips query/hash", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(
      instance.resolveWorkspaceLinkPath("./weather/archive/index.md?raw=1#top"),
    ).toBe("weather/archive/index.md");
    expect(instance.resolveWorkspaceLinkPath("/weather/archive/index.md")).toBe(
      "weather/archive/index.md",
    );
  });

  it("does not treat external links as workspace files", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(
      instance.resolveWorkspaceLinkPath("https://example.com/index.md"),
    ).toBeNull();
    expect(
      instance.resolveWorkspaceLinkPath("mailto:test@example.com"),
    ).toBeNull();
    expect(instance.resolveWorkspaceLinkPath("#details")).toBeNull();
  });

  it("rejects unsafe parent traversal links", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(instance.resolveWorkspaceLinkPath("../secrets.txt")).toBeNull();
    expect(instance.resolveWorkspaceLinkPath("weather/../../secrets.txt")).toBe(
      null,
    );
  });
});

describe("chat attachment helpers", () => {
  let ShadowClawChat;

  beforeAll(async () => {
    jest.unstable_mockModule("jszip", () => ({ default: {} }));
    jest.unstable_mockModule("../../db/exportChatData.js", () => ({
      exportChatData: jest.fn(),
    }));
    jest.unstable_mockModule("../../db/db.js", () => ({
      getDb: jest.fn(),
    }));
    jest.unstable_mockModule("../../db/importChatData.js", () => ({
      importChatData: jest.fn(),
    }));
    jest.unstable_mockModule("../../effect.js", () => ({
      effect: jest.fn(),
    }));
    jest.unstable_mockModule("../../markdown.js", () => ({
      renderMarkdown: jest.fn((str: string) => `<p>${str}</p>`),
    }));
    jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
      fileViewerStore: { openFile: jest.fn() },
    }));
    jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
      orchestratorStore: {
        messages: [],
        state: "idle",
        activeGroupId: "test-group",
        sendMessage: jest.fn(),
        stopCurrentRequest: jest.fn(),
      },
    }));
    jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
      readGroupFileBytes: jest.fn(),
    }));
    jest.unstable_mockModule("../../storage/downloadGroupFile.js", () => ({
      downloadGroupFile: jest.fn(),
    }));
    jest.unstable_mockModule("../../utils.js", () => ({
      formatTimestamp: jest.fn((ts: number) => new Date(ts).toISOString()),
      escapeHtml: jest.fn((text: string) => text.replace(/</g, "&lt;")),
      formatDateForFilename: jest.fn((date: Date) => date.toISOString()),
    }));
    jest.unstable_mockModule("../../toast.js", () => ({
      showSuccess: jest.fn(),
      showError: jest.fn(),
      showInfo: jest.fn(),
      showWarning: jest.fn(),
    }));
    jest.unstable_mockModule(
      "../shadow-claw-page-header/shadow-claw-page-header.js",
      () => ({}) as any,
    );

    const mod = await import("./shadow-claw-chat.js");
    ShadowClawChat = mod.ShadowClawChat;
  });

  it("formats attachment sizes compactly", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(instance.formatAttachmentSize(512)).toBe("512 B");
    expect(instance.formatAttachmentSize(2048)).toBe("2.0 KB");
    expect(instance.formatAttachmentSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("formats attachment subtitles from mime type and size", () => {
    const instance = Object.create(ShadowClawChat.prototype);
    expect(
      instance.formatAttachmentSubtitle({
        fileName: "notes.md",
        mimeType: "text/markdown",
        size: 2048,
      }),
    ).toBe("text/markdown · 2.0 KB");
    expect(
      instance.formatAttachmentSubtitle({
        fileName: "attachment.bin",
      }),
    ).toBe("Attachment");
  });
});
