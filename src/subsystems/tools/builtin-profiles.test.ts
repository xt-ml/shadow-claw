import { DEFAULT_BUILTIN_PROFILE } from "./builtin-profiles.js";

describe("DEFAULT_BUILTIN_PROFILE", () => {
  it("has id '__builtin_default' and targets prompt_api", () => {
    expect(DEFAULT_BUILTIN_PROFILE.id).toBe("__builtin_default");
    expect(DEFAULT_BUILTIN_PROFILE.providerId).toBe("prompt_api");
  });

  it("is limited to the default prompt api tools", () => {
    expect(DEFAULT_BUILTIN_PROFILE.enabledToolNames).toHaveLength(5);
    expect(DEFAULT_BUILTIN_PROFILE.enabledToolNames).toEqual([
      "javascript",
      "list_files",
      "open_file",
      "read_file",
      "write_file",
    ]);
  });
});
