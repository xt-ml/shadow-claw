import { jest } from "@jest/globals";

import { clearGroupMessages } from "./clearGroupMessages.mjs";

describe("clearGroupMessages", () => {
  it("deletes all cursor rows and resolves", async () => {
    const request = {};
    const cursorA = {
      delete: jest.fn(),
      continue: jest.fn(() => {
        request.result = cursorB;
        request.onsuccess();
      }),
    };
    const cursorB = {
      delete: jest.fn(),
      continue: jest.fn(() => {
        request.result = null;
        request.onsuccess();
      }),
    };

    const db = {
      transaction: jest.fn(() => ({
        objectStore: jest.fn(() => ({
          index: jest.fn(() => ({
            openCursor: jest.fn(() => request),
          })),
        })),
      })),
    };

    const pending = clearGroupMessages(db, "g");
    request.result = cursorA;
    request.onsuccess();

    await expect(pending).resolves.toBeUndefined();
    expect(cursorA.delete).toHaveBeenCalled();
    expect(cursorB.delete).toHaveBeenCalled();
  });
});
