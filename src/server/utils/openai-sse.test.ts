/** @jest-environment node */
import { jest } from "@jest/globals";
import {
  writeOpenAiDeltaChunk,
  writeOpenAiToolCallChunk,
  writeOpenAiDoneChunk,
  sendStreamingProxyError,
} from "./openai-sse.js";

describe("openai-sse", () => {
  let res: any;

  beforeEach(() => {
    res = {
      write: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      headersSent: false,
      writableEnded: false,
    };
  });

  describe("writeOpenAiDeltaChunk", () => {
    it("writes a delta chunk with content", () => {
      writeOpenAiDeltaChunk(res, "test-model", "hello");
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"content":"hello"'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"model":"test-model"'),
      );
    });
  });

  describe("writeOpenAiToolCallChunk", () => {
    it("writes a tool call chunk", () => {
      writeOpenAiToolCallChunk(res, "test-model", {
        name: "test-tool",
        input: { a: 1 },
      });
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"name":"test-tool"'),
      );
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"arguments":"{\\"a\\":1}"'),
      );
    });
  });

  describe("writeOpenAiDoneChunk", () => {
    it("writes a final chunk and [DONE]", () => {
      writeOpenAiDoneChunk(res, "test-model", "stop");
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"finish_reason":"stop"'),
      );
      expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
    });
  });

  describe("sendStreamingProxyError", () => {
    it("sends JSON error if headers not sent", () => {
      sendStreamingProxyError(res, {
        status: 500,
        publicMessage: "pub",
        streamMessage: "stream",
      });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "pub" });
    });

    it("sends SSE error if headers already sent", () => {
      res.headersSent = true;
      sendStreamingProxyError(res, {
        status: 500,
        publicMessage: "pub",
        streamMessage: "stream",
      });
      expect(res.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"stream"'),
      );
      expect(res.end).toHaveBeenCalled();
    });

    it("does nothing if writable ended", () => {
      res.headersSent = true;
      res.writableEnded = true;
      sendStreamingProxyError(res, {
        status: 500,
        publicMessage: "pub",
        streamMessage: "stream",
      });
      expect(res.write).not.toHaveBeenCalled();
    });
  });
});
