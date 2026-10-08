const { transformSync } = require("esbuild");

module.exports = {
  process(src, filename) {
    const cleanedSrc = src.replace(
      /\bwith\s*\{\s*type:\s*["'](?:css|html)["']\s*\}/g,
      "",
    );
    const result = transformSync(cleanedSrc, {
      loader: "ts",
      format: "esm",
      target: "esnext",
      sourcemap: "inline",
      sourcefile: filename,
    });

    return { code: result.code, map: result.map };
  },
};
