import * as agent from "./agent.js";

describe("worker/agent.js", () => {
  it("re-exports the worker API", () => {
    expect(typeof agent.executeTool).toBe("function");

    expect(typeof agent.handleCompact).toBe("function");

    expect(typeof agent.handleInvoke).toBe("function");

    expect(typeof agent.handleMessage).toBe("function");

    expect(typeof agent.log).toBe("function");

    expect(agent.pendingTasks).toBeDefined();

    expect(typeof agent.post).toBe("function");
  });
});
