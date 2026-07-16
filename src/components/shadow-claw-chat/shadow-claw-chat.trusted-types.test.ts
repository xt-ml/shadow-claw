import { beforeEach, describe, expect, it, jest } from "@jest/globals";

jest.unstable_mockModule("jszip", () => ({ default: {} }));

jest.unstable_mockModule("../../db/db.js", () => ({
  getDb: jest.fn(),
}));

jest.unstable_mockModule("../../db/exportChatData.js", () => ({
  exportChatData: jest.fn(),
}));

jest.unstable_mockModule("../../db/importChatData.js", () => ({
  importChatData: jest.fn(),
}));

jest.unstable_mockModule("../../db/getConfig.js", () => ({
  getConfig: jest.fn(),
}));

jest.unstable_mockModule("../../db/setConfig.js", () => ({
  setConfig: jest.fn(),
}));

jest.unstable_mockModule("../../storage/readGroupFileBytes.js", () => ({
  readGroupFileBytes: jest.fn(),
}));

jest.unstable_mockModule("../../storage/downloadGroupFile.js", () => ({
  downloadGroupFile: jest.fn(),
}));

jest.unstable_mockModule("../../content/attachment-capabilities.js", () => ({
  formatModelAttachmentCapabilitySummary: jest.fn(),
  getAttachmentCategory: jest.fn(),
  getModelAttachmentCapabilities: jest.fn(),
}));

jest.unstable_mockModule("../../core/effect.js", () => ({
  effect: jest.fn((callback: () => void) => {
    callback();

    return () => {};
  }),
}));

jest.unstable_mockModule("../../content/markdown.js", () => ({
  renderMarkdown: jest.fn((value: string) => `<p>${value}</p>`),
}));

jest.unstable_mockModule("../../security/trusted-types.js", () => ({
  sanitizeToTrustedHtml: jest.fn((html: string) => html),
  setSanitizedHtml: jest.fn((element: Element, html: string) => {
    element.innerHTML = html;

    return html;
  }),
  toTrustedHtmlPresanitized: jest.fn((html: string) => html),
  toTrustedScriptUrl: jest.fn((value: string) => value),
}));

jest.unstable_mockModule("../../stores/chat-ui.js", () => ({
  chatUiStore: {
    getGroupScrollState: jest.fn(() => null),
    reset: jest.fn(),
    setNearBottom: jest.fn(),
  },
}));

jest.unstable_mockModule("../../stores/file-viewer.js", () => ({
  fileViewerStore: { openFile: jest.fn() },
}));

jest.unstable_mockModule("../../stores/orchestrator.js", () => ({
  orchestratorStore: {
    activeGroupId: "group-1",
    messages: [
      {
        id: "m1",
        groupId: "group-1",
        isFromMe: true,
        sender: "example",
        content: "hello",
        timestamp: 1,
      },
    ],
    streamingText: null,
    tokenUsage: null,
    ready: Promise.resolve(),
    state: "idle",
  },
}));

jest.unstable_mockModule("../../content/message-attachments.js", () => ({
  inferAttachmentMimeType: jest.fn(),
  shouldInlineAttachmentInChat: jest.fn(() => false),
}));

jest.unstable_mockModule("../../ui/toast.js", () => ({
  showError: jest.fn(),
  showInfo: jest.fn(),
  showSuccess: jest.fn(),
  showWarning: jest.fn(),
}));

jest.unstable_mockModule("../../utils/utils.js", () => ({
  formatDateForFilename: jest.fn(),
  formatTimestamp: jest.fn(() => "now"),
  handleSpecialLinkNavigation: jest.fn(() => false),
  computeSha256: jest.fn(async (_: ArrayBuffer) => "mock-hash"),
}));

jest.unstable_mockModule(
  "../common/shadow-claw-page-header-action-button/shadow-claw-page-header-action-button.js",
  () => ({}),
);

jest.unstable_mockModule(
  "../shadow-claw-page-header/shadow-claw-page-header.js",
  () => ({}),
);

const { ShadowClawChat } = await import("./shadow-claw-chat.js");
const { setSanitizedHtml } = await import("../../security/trusted-types.js");

describe("shadow-claw-chat trusted types sinks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes streaming bubble HTML through the Trusted Types helper", async () => {
    const component = new ShadowClawChat();
    const messages = document.createElement("div");
    messages.className = "chat__messages";
    component.shadowRoot?.replaceChildren(messages);

    jest
      .spyOn(component, "injectMessageCopyButton")
      .mockImplementation(() => {});
    jest.spyOn(component, "injectCopyButtons").mockImplementation(() => {});
    jest
      .spyOn(component, "persistGroupScrollState")
      .mockImplementation(() => {});
    jest.spyOn(component, "setMessagesScrollTop").mockImplementation(() => {});
    jest.spyOn(component, "isContainerNearBottom").mockReturnValue(true);
    jest.spyOn(component, "shouldAutoFollow").mockReturnValue(true);

    await component.renderStreamingBubble("hello\n**bold**");

    expect(setSanitizedHtml).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "hello<br><b>bold</b>",
    );
  });
});
