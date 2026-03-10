export const marked = {
  use() {},
  parse(src) {
    return String(src).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  },
};
