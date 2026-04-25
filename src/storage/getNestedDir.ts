/**
 * Get a handle to a nested directory, creating intermediate dirs.
 */
export async function getNestedDir(
  root: FileSystemDirectoryHandle,
  ...segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = root;

  for (const seg of segments) {
    const child = await current.getDirectoryHandle(seg, { create: true });

    // Guard against stale handles (e.g. Electron after app restart) where
    // getDirectoryHandle returns the same directory instead of navigating.
    if (
      typeof current.isSameEntry === "function" &&
      (await current.isSameEntry(child))
    ) {
      throw new Error(
        `Directory navigation failed: "${seg}" resolved to the same directory as its parent. ` +
          "The stored directory handle may be stale — try re-selecting the storage folder.",
      );
    }

    current = child;
  }

  return current;
}
