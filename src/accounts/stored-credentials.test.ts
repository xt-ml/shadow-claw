import { resolveStoredCredentialAuthMode } from "./stored-credentials.js";

describe("resolveStoredCredentialAuthMode", () => {
  it("defaults to pat when credential is absent", () => {
    expect(resolveStoredCredentialAuthMode(undefined)).toBe("pat");
    expect(resolveStoredCredentialAuthMode(null)).toBe("pat");
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

  it("stays pat when oauth fields are not present", () => {
    expect(
      resolveStoredCredentialAuthMode({
        authMode: "pat",
      }),
    ).toBe("pat");
  });
});
