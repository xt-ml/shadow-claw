export function consumeEscapeSequence(text: string, startIndex: number) {
  const nextChar = text[startIndex + 1];

  if (nextChar === undefined) {
    return { action: "ignore", nextIndex: startIndex + 1, incomplete: true };
  }

  if (nextChar === "[") {
    let cursor = startIndex + 2;

    while (cursor < text.length) {
      const code = text.charCodeAt(cursor);

      if (code >= 0x40 && code <= 0x7e) {
        const finalChar = text[cursor];

        if (finalChar === "J") {
          return { action: "clear-screen", nextIndex: cursor + 1 };
        }

        if (finalChar === "K") {
          return { action: "clear-line", nextIndex: cursor + 1 };
        }

        return { action: "ignore", nextIndex: cursor + 1 };
      }

      cursor += 1;
    }

    return { action: "ignore", nextIndex: text.length, incomplete: true };
  }

  if (nextChar === "]") {
    let cursor = startIndex + 2;

    while (cursor < text.length) {
      const char = text[cursor];

      if (char === "\u0007") {
        return { action: "ignore", nextIndex: cursor + 1 };
      }

      if (char === "\u001b" && text[cursor + 1] === "\\") {
        return { action: "ignore", nextIndex: cursor + 2 };
      }

      cursor += 1;
    }

    return { action: "ignore", nextIndex: text.length, incomplete: true };
  }

  return {
    action: "ignore",
    nextIndex: Math.min(startIndex + 2, text.length),
  };
}
