import { buildLlamafileHelpDialogOptions } from "./llamafile.js";
import {
  buildProviderHelpDialogOptions,
  detectProviderHelpType,
} from "./providers.js";
import { buildTransformersJsHelpDialogOptions } from "./transformers.js";

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
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) =>
        line.includes("Settings > AI > Model Provider"),
      ),
    ).toBe(true);
    expect(dialog.links?.[0]?.href).toBe("https://openrouter.ai/keys");
  });

  it("builds rate limited dialog details with autoCloseSeconds", () => {
    const dialog = buildProviderHelpDialogOptions(
      "openrouter",
      "rate-limited",
      "Rate limit exceeded",
    );

    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Rate Limited");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(dialog.details?.some((line) => line.includes("throttling"))).toBe(
      false,
    );
    expect(dialog.message).toContain("throttling");
  });

  it("builds llamafile help dialog options with autoCloseSeconds: 30", () => {
    const dialog = buildLlamafileHelpDialogOptions("Model not found");
    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Llamafile");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) => line.includes("Model not found")),
    ).toBe(true);
  });

  it("builds transformers_js help dialog options with autoCloseSeconds: 30", () => {
    const dialog = buildTransformersJsHelpDialogOptions("Runtime missing");
    expect(dialog.mode).toBe("info");
    expect(dialog.title).toContain("Transformers.js");
    expect(dialog.autoCloseSeconds).toBe(30);
    expect(
      dialog.details?.some((line) => line.includes("Runtime missing")),
    ).toBe(true);
  });
});
