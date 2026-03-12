import { jest } from "@jest/globals";

const createEventBus = () => {
  const listeners = new Map();

  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(callback);
    },
    off(event, callback) {
      listeners.get(event)?.delete(callback);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((callback) => callback(payload));
    },
  };
};

const { ShadowClawTerminal } = await import("./shadow-claw-terminal.mjs");

function createOrchestratorStub(initialStatus) {
  const events = createEventBus();

  return {
    events,
    getVMStatus: jest.fn(() => ({ ...initialStatus })),
    openTerminalSession: jest.fn(() => {
      if (initialStatus.error) {
        events.emit("vm-terminal-error", { error: initialStatus.error });
        return;
      }

      events.emit("vm-status", {
        ready: true,
        booting: false,
        bootAttempted: true,
        error: null,
      });
      events.emit("vm-terminal-opened", { ok: true });
    }),
    sendTerminalInput: jest.fn(),
    closeTerminalSession: jest.fn(),
  };
}

describe("shadow-claw-terminal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("registers the custom element", () => {
    expect(customElements.get("shadow-claw-terminal")).toBe(ShadowClawTerminal);
  });

  it("opens the worker terminal and sends entered commands", async () => {
    const orchestrator = createOrchestratorStub({
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(orchestrator.openTerminalSession).toHaveBeenCalled();
    expect(orchestrator.sendTerminalInput).toHaveBeenCalledWith("\n");

    orchestrator.events.emit("vm-terminal-output", {
      chunk: "echo hi\r\nhi\r\n",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');
    expect(output?.textContent).toContain("echo hi\nhi\n");

    const input = element.shadowRoot?.querySelector('[data-role="input"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected terminal input");
    }

    input.value = "pwd";
    element.runCommand();

    expect(orchestrator.sendTerminalInput).toHaveBeenCalledWith("pwd\n");
  });

  it("shows boot failure state and keeps input disabled", async () => {
    const orchestrator = createOrchestratorStub({
      ready: false,
      booting: false,
      bootAttempted: true,
      error: "Assets not found",
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = element.shadowRoot?.querySelector('[data-role="status"]');
    const input = element.shadowRoot?.querySelector('[data-role="input"]');

    expect(status?.textContent).toContain("Assets not found");
    expect(input).toHaveProperty("disabled", true);
    expect(orchestrator.openTerminalSession).not.toHaveBeenCalled();
  });

  it("clears output and sends ctrl-c when requested", async () => {
    const orchestrator = createOrchestratorStub({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    orchestrator.events.emit("vm-terminal-output", { chunk: "one\n" });
    element.clearOutput();
    element.interrupt();

    const output = element.shadowRoot?.querySelector('[data-role="output"]');
    expect(output?.textContent).toBe("");
    expect(orchestrator.sendTerminalInput).toHaveBeenCalledWith("\u0003");
  });

  it("strips ANSI codes and honors clear-screen sequences", async () => {
    const orchestrator = createOrchestratorStub({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    orchestrator.events.emit("vm-terminal-output", {
      chunk: "(none):~# \u001b[6nls -al\n",
    });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "\u001b[1;34m.\u001b[m\n",
    });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "\u001b[H\u001b[J(none):~# ",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');
    expect(output?.textContent).toBe("(none):~# ");
  });

  it("handles ANSI escape sequences split across chunks", async () => {
    const orchestrator = createOrchestratorStub({
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    orchestrator.events.emit("vm-terminal-output", { chunk: "hello\u001b" });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "[1;34mworld\u001b[m\n",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');
    expect(output?.textContent).toBe("helloworld\n");

    element.clearOutput();
    orchestrator.events.emit("vm-terminal-output", { chunk: "foo\u001b[" });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "32mbar\u001b[m\n",
    });
    expect(output?.textContent).toBe("foobar\n");

    element.clearOutput();
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "(none):~# \u001b[",
    });
    orchestrator.events.emit("vm-terminal-output", { chunk: "6nfind /\n" });
    expect(output?.textContent).toBe("(none):~# find /\n");
  });
});
