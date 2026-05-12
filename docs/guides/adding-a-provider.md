# Guide: Adding a Provider

> Step-by-step: connect ShadowClaw to a new LLM provider.

## When You Need This

- New cloud provider (e.g., Mistral, Cohere, Vertex AI)
- New proxy route with a different auth scheme
- Self-hosted OpenAI-compatible endpoint

## Step 1 — Add the provider config

Open `src/config.ts` and add an entry to `PROVIDERS`:

```ts
my_provider: {
  id: "my_provider",
  name: "My Provider",
  format: "openai",     // "openai" | "anthropic" | "prompt_api"
  baseUrl: "https://api.myprovider.com/v1",
  supportsStreaming: true,
  requiresApiKey: true, // ALWAYS set this explicitly
  supportsCompaction: false, // Optional: false by default
},
```

### `format` choices

| Format         | Adapter               | Use when                                           |
| -------------- | --------------------- | -------------------------------------------------- |
| `"openai"`     | `OpenAIAdapter`       | Provider uses OpenAI `/chat/completions` format    |
| `"anthropic"`  | `AnthropicAdapter`    | Provider uses Anthropic `/messages` format         |
| `"prompt_api"` | (no adapter, special) | Browser Prompt API — no network, no key, on-device |

> The adapter (in `src/providers.ts`) automatically handles format-specific request/response transformation.

### `requiresApiKey`

- `true` — Settings UI shows API key input; orchestrator gates invocation on key presence
- `false` — No key needed (proxy-auth, on-device, or public endpoint)

**Always set this explicitly.** Omitting it causes unpredictable behavior.

### `supportsCompaction`

- `true` — Provider supports prompt compaction (if exposed by backend)
- `false` (default) — Compaction disabled for this provider

Only set this if the provider explicitly advertises compaction support (e.g., Claude API via Anthropic).

## Step 2 — API key storage (if needed)

Provider API keys are stored generically by provider id using
`getProviderApiKeyConfigKey(providerId)`, which resolves to `api_key:<providerId>`.

No extra `CONFIG_KEYS` entry is required for standard provider API keys.

If `requiresApiKey: true`, Settings and orchestrator gating use this storage path automatically.

## Step 3 — Add model context limits (optional)

If your provider exposes models not yet in the context limit registry, add a case to `getContextLimit(model)` in `src/providers.ts`:

```ts
// In getContextLimit(model)
if (m.includes("my-model-name")) {
  return 200_000; // or appropriate limit
}
```

The function uses a **fallback chain**:

1. **Model registry** (`src/model-registry.ts`) — dynamic metadata if available
2. **Pattern matching** — model name matching against known families
3. **Fallback** — defaults to 4,096 tokens if no match

When adding multiple model patterns, put more specific patterns before broader
ones so family-level matches do not hide model-specific limits.

## Step 4 — Add model fetching (optional)

If the provider supports `/models`, add it to the `fetchModels(providerId, apiKey)` function in `src/config.ts`:

```ts
case "my_provider": {
  const res = await fetch(`${provider.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const json = await res.json();
  return json.data.map((m: any) => m.id);
}
```

## Step 5 — Add proxy route (if needed)

If the provider can't be called directly from the browser (CORS restrictions, request signing, etc.), add a proxy route in `src/server/proxy.ts`:

```ts
// Proxy for My Provider
app.use("/proxy/my-provider", async (req, res) => {
  const target = `https://api.myprovider.com/v1${req.url}`;

  // Add auth headers or signing
  const headers = {
    ...req.headers,
    Authorization: `Bearer ${MY_PROVIDER_KEY}`,
    Host: "api.myprovider.com",
  };

  // For SSE: exclude from compression (already handled globally by content-type filter)
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body: req.method !== "GET" ? req : undefined,
    // @ts-ignore
    duplex: "half",
  });

  res.status(upstream.status);
  upstream.headers.forEach((v, k) => res.setHeader(k, v));
  upstream.body?.pipeTo(
    new WritableStream({
      write(chunk) {
        res.write(chunk);
      },
      close() {
        res.end();
      },
    }),
  );
});
```

Then update your provider's `baseUrl` to point to the proxy: `http://localhost:8888/proxy/my-provider`.

> **Important:** SSE responses must not be buffered by compression. The server's `compression()` filter already skips `Content-Type: text/event-stream` responses, so new SSE proxy routes are covered automatically. Verify this if your route sets a different content type.

## Step 6 — Write a test

Add to `src/config.test.ts` or a new file:

```ts
import { PROVIDERS, CONFIG_KEYS } from "./config.js";

describe("my_provider", () => {
  it("has requiresApiKey set", () => {
    expect(PROVIDERS.my_provider.requiresApiKey).toBeDefined();
  });

  it("has a valid format", () => {
    expect(["openai", "anthropic", "prompt_api"]).toContain(
      PROVIDERS.my_provider.format,
    );
  });
});
```

## Step 7 — Type-check

```bash
npm run tsc
```

## Step 8 — Test streaming (if applicable)

If your provider supports streaming, verify SSE passthrough manually:

```bash
npm start
# Open chat, select your provider, send a message with streaming enabled
```

Watch the Network tab in DevTools for `text/event-stream` responses. Each chunk should flush in real-time without buffering.

## Tips

- **Test streaming manually** after adding a new streaming provider. SSE passthrough through the proxy has subtle failure modes (compression buffering, chunked transfer encoding).
- **Model context limits:** Add a case to `getContextLimit()` in `src/providers.ts` for your model family if it's not already covered by pattern matching.
- **Dynamic model metadata:** Use `src/model-registry.ts` to cache model capabilities (tool support, context window) at startup if your API provides `/models` with capability hints.
- **Context compression:** If the provider supports prompt compaction, set `supportsCompaction: true` and validate it works with longer conversations.
- **Auto-profile activation:** If your provider uses a small or constrained model, consider creating a tool profile that activates automatically when this provider/model is selected.
