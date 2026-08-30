import { jest } from "@jest/globals";

const mockGroupFileExists = jest.fn() as any;
const mockPost = jest.fn() as any;

jest.unstable_mockModule("../../../storage/groupFileExists.js", () => ({
  groupFileExists: mockGroupFileExists,
}));

jest.unstable_mockModule("../../utils/post.js", () => ({
  post: mockPost,
}));

const { executeSendFile } = await import("./send-file.js");

describe("executeSendFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns error if path is missing or not a string", async () => {
    const res1 = await executeSendFile({} as any, {}, "peer:abc");
    expect(res1).toBe("Error: send_file requires a valid path string.");

    const res2 = await executeSendFile({} as any, { path: 123 }, "peer:abc");
    expect(res2).toBe("Error: send_file requires a valid path string.");
  });

  it("returns error if groupId is not a peer conversation", async () => {
    const res = await executeSendFile({} as any, { path: "doc.txt" }, "main");
    expect(res).toContain("Error: send_file only works in peer conversations");
  });

  it("returns error on empty path after normalization", async () => {
    const res = await executeSendFile({} as any, { path: "   " }, "peer:user1");
    expect(res).toBe("Error: send_file received an empty file path.");
  });

  it("returns error if path contains path traversal segments", async () => {
    const res = await executeSendFile(
      {} as any,
      { path: "../secret.txt" },
      "peer:user1",
    );
    expect(res).toBe("Error: send_file path cannot contain '..' segments.");
  });

  it("returns error if file does not exist in the workspace", async () => {
    mockGroupFileExists.mockResolvedValue(false);

    const res = await executeSendFile(
      {} as any,
      { path: "photos/pic.png" },
      "peer:user1",
    );
    expect(res).toBe(
      "Error: send_file could not find photos/pic.png in the workspace.",
    );
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("posts send-file message and returns success response on valid peer transfer", async () => {
    mockGroupFileExists.mockResolvedValue(true);

    const res = await executeSendFile(
      {} as any,
      { path: "shared/report.pdf" },
      "peer:node-42",
    );

    expect(mockPost).toHaveBeenCalledWith({
      type: "send-file",
      payload: {
        groupId: "peer:node-42",
        path: "shared/report.pdf",
      },
    });
    expect(res).toBe(
      "Sending file to peer: shared/report.pdf. The transfer will proceed in the background — you can continue chatting.",
    );
  });
});
