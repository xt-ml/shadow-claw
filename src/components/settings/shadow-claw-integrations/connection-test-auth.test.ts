import { resolveConnectionTestAuth } from "./connection-test-auth.js";

describe("resolveConnectionTestAuth", () => {
  it("resolves oauth authType with trimmed access token", () => {
    const result = resolveConnectionTestAuth({
      authMode: "oauth",
      pendingOauthAccessToken: "  my-access-token  ",
      passwordInput: "",
    });
    expect(result).toEqual({
      authType: "oauth",
      accessToken: "my-access-token",
    });
  });

  it("returns error when oauth access token is missing or empty", () => {
    const result: any = resolveConnectionTestAuth({
      authMode: "oauth",
      pendingOauthAccessToken: "   ",
      passwordInput: "",
    });
    expect(result.error).toContain("OAuth access token is missing");
  });

  it("resolves basic_userpass authType with trimmed password", () => {
    const result = resolveConnectionTestAuth({
      authMode: "password",
      pendingOauthAccessToken: "",
      passwordInput: "  secret-password  ",
    });
    expect(result).toEqual({
      authType: "basic_userpass",
      password: "secret-password",
    });
  });

  it("returns error when password is missing or empty", () => {
    const result: any = resolveConnectionTestAuth({
      authMode: "password",
      pendingOauthAccessToken: "",
      passwordInput: "   ",
    });
    expect(result.error).toContain("Password/app password is missing");
  });
});
