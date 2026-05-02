import {
  buildProviderHelpDialogOptions,
  detectProviderHelpType,
} from "./providers.js";

describe("provider help", () => {
  it("detects missing api key errors", () => {
    expect(
      detectProviderHelpType(
        "openrouter",
        "API key not configured. Go to Settings to add your API key.",
        true,
      ),
    ).toBe("api-key-missing");
  });

  it("detects invalid api key errors", () => {
    expect(
      detectProviderHelpType(
        "openrouter",
        "HTTP 401 Unauthorized from upstream provider",
        true,
      ),
    ).toBe("api-key-invalid");
  });

  it("detects provider connectivity errors", () => {
    expect(
      detectProviderHelpType(
        "ollama",
        "TypeError: Failed to fetch from proxy",
        false,
      ),
    ).toBe("provider-unreachable");
  });

  it("builds openrouter auth dialog details", () => {
    const dialog = buildProviderHelpDialogOptions(
      "openrouter",
      "api-key-missing",
      "Missing key",
    );

    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("API Key Required");
    expect(
      dialog.details?.some((line) => line.includes("Settings > LLM")),
    ).toBe(true);
    expect(dialog.links?.[0]?.href).toBe("https://openrouter.ai/keys");
  });
});
