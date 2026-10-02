import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("runAgentRun — persists --file attachments", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "sc-agent-file-persist-"));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("saves multiple attachments on the user message", async () => {
    const { runAgentRun } = await import("./agent.js");
    const { getAgentCore } = await import("../utils/agent-core.js");
    const core = await getAgentCore();
    const a = path.join(tmpDir, "a.png");
    const b = path.join(tmpDir, "b.txt");
    await writeFile(a, Buffer.from([1, 2, 3]));
    await writeFile(b, "hello");

    let attachments: any[] | undefined;
    const invokeHandler = async (db: any, payload: any) => {
      const msgs = await core.getRecentMessages(db, payload.groupId, 10);
      attachments = msgs.find((m: any) => m.attachments?.length)?.attachments;
      core.post({
        type: "response",
        payload: { groupId: payload.groupId, text: "ok" },
      });
    };

    const result = await runAgentRun("Describe", {
      workspace: tmpDir,
      provider: "openrouter",
      apiKey: "sk-or-v1-test",
      quiet: true,
      file: [a, b],
      invokeHandler,
      _stdinData: null,
    });

    expect(result.success).toBe(true);
    expect(attachments?.map((x) => x.fileName)).toEqual(["a.png", "b.txt"]);
    expect(attachments?.[0].path).toMatch(/^attachments\//);
  });
});
