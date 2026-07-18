import type { AccountAuthMode } from "../../../../subsystems/accounts/service-accounts.js";
import type { GitAuthMode } from "../../../../subsystems/git/types.js";

export function parseAuthMode(
  value: unknown,
): AccountAuthMode | GitAuthMode | undefined {
  if (value === "token" || value === "oauth") {
    return value;
  }

  return undefined;
}