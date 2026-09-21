import { jest, describe, it, expect, beforeEach } from "@jest/globals";

const mockConstructor = jest.fn() as any;

jest.unstable_mockModule("../../../cli/utils/control-client.js", () => {
  return {
    CliControlClient: class MockCliControlClient {
      constructor(options: any) {
        mockConstructor(options);
      }
    },
  };
});

const { nativePeerClientFactory } = await import("./native-peer-client.js");

describe("nativePeerClientFactory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("instantiates CliControlClient with transport: webrtc", () => {
    const client = nativePeerClientFactory();
    expect(client).toBeDefined();
    expect(mockConstructor).toHaveBeenCalledWith({ transport: "webrtc" });
  });
});
