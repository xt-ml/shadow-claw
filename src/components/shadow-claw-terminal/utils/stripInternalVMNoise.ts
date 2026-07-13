/**
 * Remove internal WebVM control markers and setup command echoes from the
 * visible terminal output. These are implementation details, not user output.
 */
export function stripInternalVMNoise(text: string) {
  const withoutInternalCommandEcho = text.replace(
    /(?:^|\n)[^\n]*mkdir -p \/home\/user 2>&1; echo "?__BCDONE_\d+__\$\?"?[^\n]*(?:\n|$)/g,
    "\n",
  );

  const withoutMarkers = withoutInternalCommandEcho.replace(
    /(?:^|\n)\s*__BCDONE_\d+__(?:\d+|\$\?)?\s*(?:\n|$)/g,
    "\n",
  );

  return withoutMarkers.replace(/^\n+(?=\S)/, "");
}
