import { jest } from "@jest/globals";

let resolveIntegrationEmailAuth: any;
let mockResolveServiceCredentials: any;
let mockDecryptValue: any;

describe("resolveIntegrationEmailAuth", () => {
  beforeEach(async () => {
    jest.resetModules();
    mockDecryptValue = jest.fn(async () => "password123");
    mockResolveServiceCredentials = jest.fn();

    jest.unstable_mockModule("../../../../security/crypto.js", () => ({
      decryptValue: mockDecryptValue,
    }));

    jest.unstable_mockModule(
      "../../../../subsystems/accounts/service-accounts.js",
      () => ({
        resolveServiceCredentials: mockResolveServiceCredentials,
      }),
    );

    const mod = await import("./resolveIntegrationEmailAuth.js");
    resolveIntegrationEmailAuth = mod.resolveIntegrationEmailAuth;
  });

  it("returns error when username is missing", async () => {
    const conn: any = {
      id: "conn-1",
      config: {},
    };
    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toBe(
      "Error: Integration connection conn-1 is missing username credentials.",
    );
  });

  it("handles OAuth connection missing linked accountId", async () => {
    const conn: any = {
      id: "conn-2",
      config: { username: "user@test.com" },
      credentialRef: { authType: "oauth" },
    };
    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toBe(
      "Error: Integration connection conn-2 is missing linked OAuth account.",
    );
  });

  it("handles OAuth reconnect required when creds cannot be resolved or lack token", async () => {
    mockResolveServiceCredentials.mockResolvedValueOnce(null);

    const conn: any = {
      id: "conn-3",
      config: { username: "user@test.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acc-1",
        providerId: "google",
      },
    };

    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toContain(
      "OAuth account reconnect required for integration conn-3",
    );
    expect(result).toContain("Connect OAuth for google");
  });

  it("handles OAuth success", async () => {
    mockResolveServiceCredentials.mockResolvedValueOnce({
      token: "oauth-tok-123",
    });

    const conn: any = {
      id: "conn-oauth-ok",
      config: { username: "user@test.com" },
      credentialRef: {
        authType: "oauth",
        accountId: "acc-1",
        providerId: "google",
      },
    };

    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toEqual({
      authType: "oauth",
      username: "user@test.com",
      accessToken: "oauth-tok-123",
    });
  });

  it("returns error when basic password credentials are missing", async () => {
    mockDecryptValue.mockResolvedValueOnce(null);
    const conn: any = {
      id: "conn-4",
      config: { username: "user@test.com" },
      credentialRef: { authType: "basic_userpass" },
    };
    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toBe(
      "Error: Integration connection conn-4 is missing password credentials.",
    );
  });

  it("resolves basic auth with password", async () => {
    const conn: any = {
      id: "conn-5",
      config: { username: "user@test.com" },
      credentialRef: { authType: "basic_userpass", encryptedSecret: "enc:pw" },
    };
    const result = await resolveIntegrationEmailAuth({} as any, conn, {});
    expect(result).toEqual({
      authType: "basic_userpass",
      username: "user@test.com",
      password: "password123",
    });
  });
});
