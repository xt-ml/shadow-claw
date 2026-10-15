export function historyState(history: History, finalPath: string, options) {
  const finalPathWithSlash =
    options.useTrailingSlash && !finalPath.includes("#")
      ? finalPath.endsWith("/")
        ? finalPath
        : finalPath + "/"
      : finalPath;

  if (options.replace) {
    history.replaceState({}, "", finalPathWithSlash);
  } else {
    history.pushState({}, "", finalPathWithSlash);
  }
}
