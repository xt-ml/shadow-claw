import { resolveStoredCredentialAuthMode } from "./stored-credentials.js";

describe("resolveStoredCredentialAuthMode", () => {
  it("defaults to token when credential is absent", () => {
    expect(resolveStoredCredentialAuthMode(undefined)).toBe("token");
    expect(resolveStoredCredentialAuthMode(null)).toBe("token");
  });

  it("preserves explicit oauth auth mode", () => {
    expect(
      resolveStoredCredentialAuthMode({
        authMode: "oauth",
      }),
    ).toBe("oauth");
  });

  it("infers oauth mode from oauth-specific fields", () => {
    expect(
      resolveStoredCredentialAuthMode({
        refreshToken: "refresh-token",
      }),
    ).toBe("oauth");

    expect(
      resolveStoredCredentialAuthMode({
        oauthReauthRequired: true,
      }),
    ).toBe("oauth");
  });

  it("stays token when oauth fields are not present", () => {
    expect(
      resolveStoredCredentialAuthMode({
        authMode: "token",
      }),
    ).toBe("token");
  });
});
