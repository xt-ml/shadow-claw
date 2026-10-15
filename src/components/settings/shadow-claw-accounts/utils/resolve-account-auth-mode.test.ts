import { resolveAccountAuthMode } from "./resolve-account-auth-mode.js";

describe("resolveAccountAuthMode", () => {
  it("returns 'token' when account is null or undefined", () => {
    expect(resolveAccountAuthMode(null)).toBe("token");
    expect(resolveAccountAuthMode(undefined as any)).toBe("token");
  });

  it("returns 'token' when authMode is 'token'", () => {
    expect(resolveAccountAuthMode({ authMode: "token" } as any)).toBe("token");
  });

  it("returns 'basic' when authMode is 'basic'", () => {
    expect(resolveAccountAuthMode({ authMode: "basic" } as any)).toBe("basic");
  });

  it("returns 'oauth' when authMode is 'oauth'", () => {
    expect(resolveAccountAuthMode({ authMode: "oauth" } as any)).toBe("oauth");
  });

  it("infers 'oauth' from oauth metadata fields when authMode is absent", () => {
    expect(resolveAccountAuthMode({ oauthProviderId: "google" } as any)).toBe(
      "oauth",
    );
    expect(resolveAccountAuthMode({ oauthClientId: "client-id" } as any)).toBe(
      "oauth",
    );
    expect(
      resolveAccountAuthMode({ oauthClientSecret: "client-secret" } as any),
    ).toBe("oauth");
    expect(
      resolveAccountAuthMode({ refreshToken: "refresh-token" } as any),
    ).toBe("oauth");
    expect(
      resolveAccountAuthMode({ accessTokenExpiresAt: 123456789 } as any),
    ).toBe("oauth");
    expect(resolveAccountAuthMode({ tokenType: "Bearer" } as any)).toBe(
      "oauth",
    );
    expect(resolveAccountAuthMode({ oauthReauthRequired: true } as any)).toBe(
      "oauth",
    );
  });

  it("defaults to 'token' when authMode is absent and no oauth fields exist", () => {
    expect(resolveAccountAuthMode({} as any)).toBe("token");
    expect(resolveAccountAuthMode({ username: "admin" } as any)).toBe("token");
  });
});
