import { AccountAuthMode } from "../../../../subsystems/accounts/service-accounts";
import { GitAuthMode } from "../../../../subsystems/git/types";

export function parseAuthMode(
  value: unknown,
): AccountAuthMode | GitAuthMode | undefined {
  if (value === "token" || value === "oauth") {
    return value;
  }

  return undefined;
}
