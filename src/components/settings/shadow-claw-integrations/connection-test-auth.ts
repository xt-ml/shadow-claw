export interface ResolveConnectionTestAuthInput {
  authMode: string | null | undefined;
  pendingOauthAccessToken?: string;
  passwordInput?: string;
  hasStoredOauthCredential?: boolean;
  hasStoredPasswordCredential?: boolean;
}

export type ResolveConnectionTestAuthResult =
  | {
      authType: "oauth";
      accessToken: string;
    }
  | {
      authType: "basic_userpass";
      password: string;
    }
  | {
      error: string;
    };

export function resolveConnectionTestAuth(
  input: ResolveConnectionTestAuthInput,
): ResolveConnectionTestAuthResult {
  if (input.authMode === "oauth") {
    const accessToken = (input.pendingOauthAccessToken || "").trim();
    if (accessToken) {
      return {
        authType: "oauth",
        accessToken,
      };
    }

    return {
      error:
        "OAuth access token is missing. Click Connect OAuth first (or save and reconnect).",
    };
  }

  const password = (input.passwordInput || "").trim();
  if (password) {
    return {
      authType: "basic_userpass",
      password,
    };
  }

  return {
    error:
      "Password/app password is missing. Enter it to test this connection.",
  };
}
