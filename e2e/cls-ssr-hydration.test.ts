import { test, expect } from "@playwright/test";

test.describe("SSR to CSR Hydration Layout Shift (CLS)", () => {
  test("maintains minimal layout shift (CLS < 0.02) during SSR-to-CSR hydration", async ({
    page,
    context,
  }) => {
    // Record layout shifts from page init
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            window.__shifts.push(entry.value);
          }
        }
      }).observe({ type: "layout-shift", buffered: true });
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for custom elements hydration
    await page.evaluate(async () => {
      await Promise.all([
        customElements.whenDefined("shadow-claw"),
        customElements.whenDefined("shadow-claw-pages"),
      ]);
    });

    // Short buffer to ensure any post-hydration effects settle
    await page.waitForTimeout(1000);

    const totalCls = await page.evaluate(() => {
      return (window.__shifts || []).reduce(
        (acc: number, val: number) => acc + val,
        0,
      );
    });

    // The threshold for good CLS is < 0.1, but we enforce strict < 0.02 to catch any SSR/CSR jump regressions
    expect(totalCls).toBeLessThan(0.02);
  });
});
