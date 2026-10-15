let cachedHfDomain: string | null = null;

export const getHuggingFaceDomain = async () => {
  if (cachedHfDomain) {
    return cachedHfDomain;
  }

  const mainDomain = "huggingface.co";
  const mirrorDomain = "hf-mirror.com";
  const testPath = "/webml/models-moved/resolve/main/01.onnx";

  // Helper to test a specific domain with a timeout
  const checkDomain = async (domain: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      const response = await fetch(`https://${domain}${testPath}`, {
        method: "HEAD", // Use HEAD to download headers only (lighter than GET)
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      console.log(`Error reaching ${domain}:`, error);
      clearTimeout(timeoutId);

      return false;
    }
  };

  // 1. Try the main domain first
  const isMainReachable = await checkDomain(mainDomain);
  if (isMainReachable) {
    cachedHfDomain = mainDomain;

    return mainDomain;
  }

  // 2. If main fails, try the mirror
  const isMirrorReachable = await checkDomain(mirrorDomain);
  if (isMirrorReachable) {
    console.log(
      `Hugging Face main domain unreachable. Switching to mirror: ${mirrorDomain}`,
    );
    cachedHfDomain = mirrorDomain;

    return mirrorDomain;
  }

  // 3. Default fallback
  cachedHfDomain = mainDomain;

  return mainDomain;
};
