import { jest } from "@jest/globals";

describe("src/serve.mjs proxy simulation", () => {
  // Simplified version of the proxy logic from serve.mjs for testing
  async function simulateProxy(req) {
    const target = req.body?.url || req.query?.url;
    if (!target)
      return {
        status: 400,
        body: JSON.stringify({ error: "Missing 'url' parameter" }),
      };

    const method = req.body?.method || "GET";
    const headers = { ...req.body?.headers };
    const body = req.body?.body;

    try {
      const upstream = await fetch(target, {
        method,
        headers,
        body: method === "GET" ? undefined : body,
      });
      return {
        status: upstream.status,
        body: await upstream.text(),
      };
    } catch (err) {
      return {
        status: 500,
        body: JSON.stringify({ error: "Proxy request failed" }),
      };
    }
  }

  it("should proxy GET requests", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      text: async () => "OK",
      headers: new Headers(),
    });

    const response = await simulateProxy({
      body: {
        url: "https://httpbin.org/headers",
        method: "GET",
        headers: { "X-Test": "Passed" },
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toBe("OK");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://httpbin.org/headers",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
