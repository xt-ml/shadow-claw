export async function applyAnchorWithRetry(
  apply: () => boolean,
  maxAttempts = 3,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (apply()) {
      return;
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
}
