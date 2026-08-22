export function isCustomElementScriptDomainAllowed(urlStr, allowedDomains) {
  if (
    !urlStr.startsWith("http://") &&
    !urlStr.startsWith("https://") &&
    !urlStr.startsWith("//")
  ) {
    return true;
  }

  if (
    !allowedDomains ||
    (Array.isArray(allowedDomains) && allowedDomains.length === 0)
  ) {
    return true;
  }

  try {
    const url = new URL(urlStr, "https://localhost");
    const hostname = url.hostname.toLowerCase();
    const domainList = Array.isArray(allowedDomains)
      ? allowedDomains
      : String(allowedDomains).split(/[\n,]+/);

    return domainList.some((d) => {
      const pattern = d.trim().toLowerCase();
      return (
        hostname === pattern ||
        hostname.endsWith("." + pattern) ||
        pattern === "*"
      );
    });
  } catch {
    return false;
  }
}
