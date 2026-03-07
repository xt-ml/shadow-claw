/**
 * Get a handle to a nested directory, creating intermediate dirs.
 *
 * @param {FileSystemDirectoryHandle} root
 * @param {...string} segments
 *
 * @returns {Promise<FileSystemDirectoryHandle>}
 */
export async function getNestedDir(root, ...segments) {
  let current = root;

  for (const seg of segments) {
    current = await current.getDirectoryHandle(seg, { create: true });
  }

  return current;
}
