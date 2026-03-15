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
  /** @type {typeof globalThis.requestAnimationFrame|undefined} */
  let originalRequestAnimationFrame;
  /** @type {typeof globalThis.cancelAnimationFrame|undefined} */
  let originalCancelAnimationFrame;

  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = "";

    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

    globalThis.requestAnimationFrame = (callback) => {
      callback(0);
      return 1;
    };

    globalThis.cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    }

    if (originalCancelAnimationFrame) {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    }
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

    expect(orchestrator.sendTerminalInput).not.toHaveBeenCalledWith("\n");

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

  it("opens terminal when VM leaves disabled state and starts booting", async () => {
    const events = createEventBus();
    const orchestrator = {
      events,
      getVMStatus: jest.fn(() => ({
        ready: false,
        booting: false,
        bootAttempted: true,
        error: "WebVM is disabled. Enable it in Settings to use WebVM.",
      })),
      openTerminalSession: jest.fn(),
      sendTerminalInput: jest.fn(),
      closeTerminalSession: jest.fn(),
    };

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(orchestrator.openTerminalSession).not.toHaveBeenCalled();

    orchestrator.events.emit("vm-status", {
      ready: false,
      booting: true,
      bootAttempted: true,
      error: null,
    });

    expect(orchestrator.openTerminalSession).toHaveBeenCalledTimes(1);
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

  it("preserves visible prompt when clear is pressed", async () => {
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
      chunk:
        "localhost:~# cat /workspace/foo/Testing\nfile contents\nlocalhost:~# ",
    });

    element.clearOutput();

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toBe("localhost:~# ");
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

  it("preserves boot transcript when clear-screen escapes arrive before VM is ready", async () => {
    const events = createEventBus();
    const orchestrator = {
      events,
      getVMStatus: jest.fn(() => ({
        ready: false,
        booting: true,
        bootAttempted: true,
        error: null,
      })),
      openTerminalSession: jest.fn(),
      sendTerminalInput: jest.fn(),
      closeTerminalSession: jest.fn(),
    };

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    orchestrator.events.emit("vm-terminal-output", {
      chunk: "Booting kernel\n",
    });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "\u001b[H\u001b[J",
    });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "Loading init drivers\n",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toContain("Booting kernel\n");
    expect(output?.textContent).toContain("Loading init drivers\n");
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

  it("collapses CR-based prompt redraw spam to a single visible prompt", async () => {
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

    // Initial prompt
    orchestrator.events.emit("vm-terminal-output", { chunk: "localhost:~# " });

    // Shell redraws: CR arrives alone (deferred) then the next char resolves it
    // as a lone CR (not CRLF), clearing the current line.
    orchestrator.events.emit("vm-terminal-output", { chunk: "\r" });
    orchestrator.events.emit("vm-terminal-output", { chunk: "l" });
    for (const c of "ocalhost:~# ") {
      orchestrator.events.emit("vm-terminal-output", { chunk: c });
    }

    // Another redraw
    orchestrator.events.emit("vm-terminal-output", { chunk: "\r" });
    orchestrator.events.emit("vm-terminal-output", { chunk: "l" });
    for (const c of "ocalhost:~# ") {
      orchestrator.events.emit("vm-terminal-output", { chunk: c });
    }

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toBe("localhost:~# ");
  });

  it("preserves CRLF boot output when CR and LF arrive as separate single-byte chunks", async () => {
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

    // Simulate serial port delivering CRLF one byte at a time
    for (const c of "Booting kernel\r\nAlpine Linux 3.21\r\n") {
      orchestrator.events.emit("vm-terminal-output", { chunk: c });
    }

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toBe("Booting kernel\nAlpine Linux 3.21\n");
  });

  it("drops internal WebVM completion markers from visible output", async () => {
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
      chunk: "echo hi\n__BCDONE_1773436232041__0\n",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toBe("echo hi\n");
  });

  it("drops internal WebVM bootstrap command echo noise", async () => {
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
      chunk:
        'localhost:~# mkdir -p /workspace 2>&1; echo "__BCDONE_1773440632906__$?"\n',
    });
    orchestrator.events.emit("vm-terminal-output", {
      chunk: "__BCDONE_1773440632906__0\nlocalhost:~# ",
    });

    const output = element.shadowRoot?.querySelector('[data-role="output"]');

    expect(output?.textContent).toBe("localhost:~# ");
  });

  it("reconnects terminal after mode switch closes previous session", async () => {
    const orchestrator = createOrchestratorStub({
      ready: false,
      booting: true,
      bootAttempted: true,
      error: null,
    });

    const element = new ShadowClawTerminal();
    element.orchestrator = orchestrator;
    document.body.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Simulate mode switch closing the current terminal bridge.
    orchestrator.events.emit("vm-terminal-closed", { ok: true });

    // New VM boots and reports ready; component should auto-attach again.
    orchestrator.events.emit("vm-status", {
      ready: true,
      booting: false,
      bootAttempted: true,
      error: null,
    });

    expect(orchestrator.openTerminalSession).toHaveBeenCalledTimes(2);

    const status = element.shadowRoot?.querySelector('[data-role="status"]');
    const input = element.shadowRoot?.querySelector('[data-role="input"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Expected terminal input");
    }

    expect(status?.textContent).toContain("Connected to Alpine WebVM");

    expect(input.disabled).toBe(false);

    expect(input.placeholder).toBe("Type a shell command");
  });

  it("keeps auto-scrolling while output arrives when user stays at bottom", async () => {
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

    const screen = element.shadowRoot?.querySelector('[data-role="screen"]');
    if (!(screen instanceof HTMLElement)) {
      throw new Error("Expected terminal screen");
    }

    Object.defineProperty(screen, "clientHeight", {
      configurable: true,
      value: 120,
    });
    Object.defineProperty(screen, "scrollHeight", {
      configurable: true,
      get() {
        return 600;
      },
    });

    screen.scrollTop = 480;

    orchestrator.events.emit("vm-terminal-output", { chunk: "line 1\n" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.scrollTop).toBe(600);
  });

  it("pauses auto-scroll when user scrolls up and resumes when they return to bottom", async () => {
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

    const screen = element.shadowRoot?.querySelector('[data-role="screen"]');
    if (!(screen instanceof HTMLElement)) {
      throw new Error("Expected terminal screen");
    }

    Object.defineProperty(screen, "clientHeight", {
      configurable: true,
      value: 120,
    });

    let scrollHeightValue = 600;
    Object.defineProperty(screen, "scrollHeight", {
      configurable: true,
      get() {
        return scrollHeightValue;
      },
    });

    // User manually scrolls away from the bottom.
    screen.scrollTop = 120;
    screen.dispatchEvent(new Event("scroll"));

    // New output should not force scroll while user is browsing history.
    scrollHeightValue = 700;
    orchestrator.events.emit("vm-terminal-output", { chunk: "line 1\n" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.scrollTop).toBe(120);

    // User returns to bottom; auto-scroll should resume for subsequent output.
    screen.scrollTop = 580;
    screen.dispatchEvent(new Event("scroll"));

    scrollHeightValue = 760;
    orchestrator.events.emit("vm-terminal-output", { chunk: "line 2\n" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.scrollTop).toBe(760);
  });
});
