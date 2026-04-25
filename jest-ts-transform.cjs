const { transformSync } = require("esbuild");

module.exports = {
  process(src, filename) {
    const result = transformSync(src, {
      loader: "ts",
      format: "esm",
      target: "esnext",
      sourcemap: "inline",
      sourcefile: filename,
    });

    return { code: result.code, map: result.map };
  },
};
