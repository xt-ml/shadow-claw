import { consumeEscapeSequence } from "./consumeEscapeSequence.js";

describe("consumeEscapeSequence", () => {
  it("handles end of string right after escape character", () => {
    const res = consumeEscapeSequence("\x1b", 0);
    expect(res).toEqual({ action: "ignore", nextIndex: 1, incomplete: true });
  });

  describe("CSI sequences (\\x1b[)", () => {
    it("handles clear-screen sequence ending with J (e.g. \\x1b[2J)", () => {
      const res = consumeEscapeSequence("\x1b[2JHello", 0);
      expect(res).toEqual({ action: "clear-screen", nextIndex: 4 });
    });

    it("handles clear-line sequence ending with K (e.g. \\x1b[K)", () => {
      const res = consumeEscapeSequence("\x1b[KRest", 0);
      expect(res).toEqual({ action: "clear-line", nextIndex: 3 });
    });

    it("handles other CSI sequences (e.g. color \\x1b[31m)", () => {
      const res = consumeEscapeSequence("\x1b[31mRed text", 0);
      expect(res).toEqual({ action: "ignore", nextIndex: 5 });
    });

    it("handles incomplete CSI sequence at end of buffer", () => {
      const res = consumeEscapeSequence("\x1b[31", 0);
      expect(res).toEqual({ action: "ignore", nextIndex: 4, incomplete: true });
    });
  });

  describe("OSC sequences (\\x1b])", () => {
    it("handles OSC sequence terminated by BEL (\\u0007)", () => {
      const res = consumeEscapeSequence("\x1b]0;Title\u0007Remaining", 0);
      expect(res).toEqual({ action: "ignore", nextIndex: 10 });
    });

    it("handles OSC sequence terminated by ST (\\u001b\\\\)", () => {
      const res = consumeEscapeSequence("\x1b]0;Title\u001b\\Remaining", 0);
      expect(res).toEqual({ action: "ignore", nextIndex: 11 });
    });

    it("handles incomplete OSC sequence at end of buffer", () => {
      const res = consumeEscapeSequence("\x1b]0;Incomplete", 0);
      expect(res).toEqual({
        action: "ignore",
        nextIndex: 14,
        incomplete: true,
      });
    });
  });

  describe("Other escape sequences", () => {
    it("handles simple 2-char escape sequence (e.g. \\x1bM)", () => {
      const res = consumeEscapeSequence("\x1bMRest", 0);
      expect(res).toEqual({ action: "ignore", nextIndex: 2 });
    });
  });
});
