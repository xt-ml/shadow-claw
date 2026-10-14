import { jest } from "@jest/globals";
import { EventEmitter } from "node:events";

describe("attachPeerServer", () => {
  it("attaches ExpressPeerServer and listens to connection and disconnect events", async () => {
    const mockPeerServer: any = new EventEmitter();
    const expressPeerServerMock = jest.fn(() => mockPeerServer);

    jest.unstable_mockModule("peer", () => ({
      ExpressPeerServer: expressPeerServerMock,
    }));

    const { attachPeerServer } = await import("./peer.js");

    const mockHttpServer: any = {};
    const mockApp: any = {
      use: jest.fn(),
    };

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    try {
      attachPeerServer(mockHttpServer, mockApp);

      expect(expressPeerServerMock).toHaveBeenCalledWith(mockHttpServer, {
        path: "/",
        allow_discovery: false,
      });
      expect(mockApp.use).toHaveBeenCalledWith(mockPeerServer);

      const mockClient = { getId: () => "peer-client-123" };
      mockPeerServer.emit("connection", mockClient);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("PeerJS: client connected — peer-client-123"),
      );

      mockPeerServer.emit("disconnect", mockClient);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "PeerJS: client disconnected — peer-client-123",
        ),
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
