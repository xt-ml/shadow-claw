import { nativeEvalExecutor } from "./native-eval-executor.js";
import { sandboxedEval, setHeadlessEvalExecutor } from "./sandboxedEval.js";

describe("nativeEvalExecutor", () => {
  it("evaluates javascript expressions in node:vm", async () => {
    const res = await nativeEvalExecutor("return 2 + 2;", 5000, false);
    expect(res).toEqual({ ok: true, value: 4 });
  });

  it("handles injected $PIPE_DATA and data parameter", async () => {
    const res = await nativeEvalExecutor(
      "const d = JSON.parse(data); return d.val * 3;",
      5000,
      false,
      JSON.stringify({ val: 10 }),
    );
    expect(res).toEqual({ ok: true, value: 30 });
  });

  it("integrates with sandboxedEval when Worker is undefined", async () => {
    setHeadlessEvalExecutor(nativeEvalExecutor);
    const origWorker = (globalThis as any).Worker;
    try {
      delete (globalThis as any).Worker;
      const res = await sandboxedEval("return 100 * 2;");
      expect(res).toEqual({ ok: true, value: 200 });
    } finally {
      (globalThis as any).Worker = origWorker;
    }
  });

  it("handles evaluation timeout gracefully", async () => {
    const res = await nativeEvalExecutor("while(true) {}", 50, false);
    expect(res.ok).toBe(false);
  });
});
