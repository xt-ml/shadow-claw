exports.marked = {
  parse: (val, options) => {
    if (typeof val !== "string") {
      return val;
    }

    let res = val
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n\n/g, "</p><p>");

    if (options?.breaks) {
      res = res.replace(/\n/g, "<br>");
    }

    if (val.includes("\n\n") || !val.includes("\n")) {
      res = `<p>${res}</p>`;
    }

    return res;
  },
  use: () => {},
};
