import { shouldBypassFetchProxy } from "./fetch-proxy-rules.js";

describe("shouldBypassFetchProxy", () => {
  it("bypasses direct Telegram Bot API requests", () => {
    const requestUrl = new URL(
      "https://api.telegram.org/bot123456:getUpdates?offset=0&timeout=30",
    );

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:8888")).toBe(
      true,
    );
  });

  it("does not bypass unrelated cross-origin requests", () => {
    const requestUrl = new URL("https://example.com/api/weather");

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:8888")).toBe(
      false,
    );
  });

  it("bypasses loopback real share target HTML endpoint", () => {
    const requestUrl = new URL(
      "http://localhost:8888/shadow-claw/share/share-target.html",
    );

    expect(shouldBypassFetchProxy(requestUrl, "http://localhost:9999")).toBe(
      true,
    );
  });

  it("bypasses Hugging Face CDN subdomains", () => {
    expect(
      shouldBypassFetchProxy(
        new URL(
          "https://us.aws.cdn.hf.co/onnx-community/gemma-3-1b-it-ONNX-GQA/model.onnx_data",
        ),
        "http://localhost:8888",
      ),
    ).toBe(true);

    expect(
      shouldBypassFetchProxy(
        new URL("https://cdn-lfs.huggingface.co/raw/model.bin"),
        "http://localhost:8888",
      ),
    ).toBe(true);

    expect(
      shouldBypassFetchProxy(
        new URL(
          "https://hf-mirror.com/onnx-community/Qwen3-0.6B-ONNX/resolve/main/model_q4.onnx",
        ),
        "http://localhost:8888",
      ),
    ).toBe(true);

    expect(
      shouldBypassFetchProxy(
        new URL(
          "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js",
        ),
        "http://localhost:8888",
      ),
    ).toBe(true);
  });
});
