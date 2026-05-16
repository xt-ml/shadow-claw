import { describe, expect, it } from "@jest/globals";

import { resolveConnectionTestAuth } from "./connection-test-auth.js";

describe("resolveConnectionTestAuth", () => {
  it("uses pending oauth token when provided", () => {
    const result = resolveConnectionTestAuth({
      authMode: "oauth",
      pendingOauthAccessToken: "oauth-token",
    });

    expect(result).toEqual({
      authType: "oauth",
      accessToken: "oauth-token",
    });
  });

  it("requires a fresh oauth token and does not reuse stored encrypted credentials", () => {
    const result = resolveConnectionTestAuth({
      authMode: "oauth",
      pendingOauthAccessToken: "",
      hasStoredOauthCredential: true,
    });

    expect(result).toEqual({
      error:
        "OAuth access token is missing. Click Connect OAuth first (or save and reconnect).",
    });
  });

  it("uses entered password for basic auth", () => {
    const result = resolveConnectionTestAuth({
      authMode: "basic",
      passwordInput: "app-password",
    });

    expect(result).toEqual({
      authType: "basic_userpass",
      password: "app-password",
    });
  });

  it("requires explicit password entry and does not decrypt stored secret", () => {
    const result = resolveConnectionTestAuth({
      authMode: "basic",
      passwordInput: "",
      hasStoredPasswordCredential: true,
    });

    expect(result).toEqual({
      error:
        "Password/app password is missing. Enter it to test this connection.",
    });
  });
});
