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

  it("bypasses loopback endpoints when accessed from GitHub Pages origin", () => {
    const sseUrl = new URL(
      "http://127.0.0.1:8888/api/control/events?clientId=shadow-claw-test",
    );
    expect(
      shouldBypassFetchProxy(sseUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);

    const messagesUrl = new URL("http://localhost:8888/api/control/messages");
    expect(
      shouldBypassFetchProxy(
        messagesUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);

    const wsUrl = new URL("http://[::1]:8888/ws/control");
    expect(
      shouldBypassFetchProxy(wsUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);
  });

  it("bypasses private LAN IP endpoints when accessed from GitHub Pages origin", () => {
    const lanUrl = new URL(
      "http://192.168.1.100:8888/api/control/events?clientId=shadow-claw-test",
    );
    expect(
      shouldBypassFetchProxy(lanUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);

    const classBUrl = new URL("http://172.20.0.5:8888/api/control/events");
    expect(
      shouldBypassFetchProxy(classBUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);

    const classAUrl = new URL("http://10.0.0.2:8888/api/control/events");
    expect(
      shouldBypassFetchProxy(classAUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);
  });

  it("bypasses single-label local hostnames like hostname", () => {
    const pushUrl = new URL("https://hostname:8888/push/vapid-public-key");
    expect(
      shouldBypassFetchProxy(pushUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);

    const taskUrl = new URL("https://hostname:8888/schedule/tasks");
    expect(
      shouldBypassFetchProxy(taskUrl, "https://xt-ml.github.io/shadow-claw/"),
    ).toBe(true);
  });

  it("bypasses mDNS .local and local network domain endpoints", () => {
    const localDomainUrl = new URL(
      "https://hostname.local:8888/api/control/events",
    );
    expect(
      shouldBypassFetchProxy(
        localDomainUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);

    const lanDomainUrl = new URL("https://server.lan:8888/schedule/tasks");
    expect(
      shouldBypassFetchProxy(
        lanDomainUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);
  });

  it("bypasses built-in backend routes even on custom domains", () => {
    const pushSubscribeUrl = new URL(
      "https://custom.example.com/push/subscribe",
    );
    expect(
      shouldBypassFetchProxy(
        pushSubscribeUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);

    const scheduleUrl = new URL("https://custom.example.com/schedule/tasks");
    expect(
      shouldBypassFetchProxy(
        scheduleUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);

    const controlUrl = new URL(
      "https://custom.example.com/api/control/messages",
    );
    expect(
      shouldBypassFetchProxy(
        controlUrl,
        "https://xt-ml.github.io/shadow-claw/",
      ),
    ).toBe(true);
  });

  it("bypasses requests destined for the proxy server itself", () => {
    const targetUrl = new URL("https://proxy.example.com:9000/api/custom");
    expect(
      shouldBypassFetchProxy(
        targetUrl,
        "https://xt-ml.github.io/shadow-claw/",
        "https://proxy.example.com:9000/proxy",
      ),
    ).toBe(true);
  });
});
