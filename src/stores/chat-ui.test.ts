import { jest } from "@jest/globals";

import { ChatUiStore } from "./chat-ui.js";

describe("ChatUiStore", () => {
  it("tracks near-bottom state", () => {
    const store = new ChatUiStore();

    expect(store.isNearBottom).toBe(true);

    store.setNearBottom(false);
    expect(store.isNearBottom).toBe(false);

    store.resetNearBottom();
    expect(store.isNearBottom).toBe(true);
  });

  it("registers and revokes attachment object URLs", () => {
    const store = new ChatUiStore();
    const originalRevoke = (URL as any).revokeObjectURL;
    const revokeSpy = jest.fn();
    (URL as any).revokeObjectURL = revokeSpy;

    store.registerAttachmentObjectUrl("blob:test-1");
    store.registerAttachmentObjectUrl("blob:test-2");
    store.revokeAttachmentObjectUrls();

    expect(revokeSpy).toHaveBeenCalledWith("blob:test-1");
    expect(revokeSpy).toHaveBeenCalledWith("blob:test-2");
    expect(revokeSpy).toHaveBeenCalledTimes(2);

    (URL as any).revokeObjectURL = originalRevoke;
  });
});
