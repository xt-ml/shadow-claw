export interface ResolvedBuildFlags {
  isProduction: boolean;
  copyAllAssets: boolean;
  prerenderPages: string;
  prerenderMainMemory: boolean;
}

export function resolveBuildFlags(
  environment: Record<string, string | undefined> = {},
): ResolvedBuildFlags {
  const prerenderPages = environment.PRERENDER_PAGES || "all";

  return {
    isProduction: environment.NODE_ENV === "production",
    copyAllAssets: environment.COPY_ALL_ASSETS === "true",
    prerenderPages,
    prerenderMainMemory:
      environment.PRERENDER_MAIN_MEMORY !== "false" &&
      prerenderPages !== "none" &&
      prerenderPages !== "0",
  };
}
