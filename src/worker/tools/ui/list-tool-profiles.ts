import { getConfig } from "../../../db/getConfig.js";
import { NANO_BUILTIN_PROFILE } from "../../../subsystems/tools/builtin-profiles.js";
import { CONFIG_KEYS } from "../../../config/config.js";
import { ShadowClawDatabase } from "../../../db/types.js";

export async function executeListToolProfiles(
  db: ShadowClawDatabase,
): Promise<string> {
  const profilesRaw = await getConfig(db, CONFIG_KEYS.TOOL_PROFILES);
  let profiles: any[] = [];
  if (typeof profilesRaw === "string") {
    try {
      profiles = JSON.parse(profilesRaw);
    } catch {
      profiles = [];
    }
  } else if (Array.isArray(profilesRaw)) {
    profiles = profilesRaw;
  }

  const allProfiles = [NANO_BUILTIN_PROFILE, ...profiles];

  return allProfiles
    .map(
      (p) =>
        `[Profile ID: ${p.id}] ${p.name}\n  Tools: ${p.enabledToolNames.join(", ")}`,
    )
    .join("\n\n");
}
