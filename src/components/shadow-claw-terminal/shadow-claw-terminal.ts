import { orchestratorStore } from "../../stores/orchestrator.js";
import { VMStatusPayload } from "../../types.js";
import ShadowClawElement from "../shadow-claw-element.js";

const MAX_OUTPUT_LENGTH = 80_000;
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 12;

const elementName = "shadow-claw-terminal";
export class ShadowClawTerminal extends ShadowClawElement {
  static componentPath = `components/${elementName}`;
  static styles = `${ShadowClawTerminal.componentPath}/${elementName}.css`;
  static template = `${ShadowClawTerminal.componentPath}/${elementName}.html`;

  session: any | null;
  outputBuffer: string;
  pendingEscape: string;
  cleanups: Array<() => void>;
  bootRequested: boolean;
  orchestrator: any | null;
  vmStatus: any;
  connectedToWorkerTerminal: boolean;
  terminalAttachRequested: boolean;
  autoScrollEnabled: boolean;
  isApplyingAutoScroll: boolean;
  pendingAutoScrollFrame: number | null;
  screenResizeObserver: ResizeObserver | null;

  constructor() {
    super();

    this.session = null;
    this.outputBuffer = "";
    this.pendingEscape = "";
    this.cleanups = [];
    this.bootRequested = false;
    this.orchestrator = orchestratorStore.orchestrator;
    this.vmStatus = {
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    };

    this.connectedToWorkerTerminal = false;
    this.terminalAttachRequested = false;
    this.autoScrollEnabled = true;
    this.isApplyingAutoScroll = false;
    this.pendingAutoScrollFrame = null;
    this.screenResizeObserver = null;
  }

  async connectedCallback() {
    await Promise.all([this.onStylesReady, this.onTemplateReady]);

    await this.render();
    this.renderOutput();

    this.bindEventListeners();
    this.bindResizeObserver();

    this.connectOrchestrator();
    this.startTerminal();
  }

  disconnectedCallback() {
    if (this.pendingAutoScrollFrame !== null) {
      cancelAnimationFrame(this.pendingAutoScrollFrame);
      this.pendingAutoScrollFrame = null;
    }

    this.screenResizeObserver?.disconnect();
    this.screenResizeObserver = null;

    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.connectedToWorkerTerminal = false;
    this.terminalAttachRequested = false;
    this.orchestrator?.closeTerminalSession?.(orchestratorStore.activeGroupId);
  }

  connectOrchestrator() {
    if (!this.orchestrator) {
      return;
    }

    const statusListener = (status: VMStatusPayload) => {
      this.vmStatus = status;
      this.updateStatus(status);

      if (
        !status.error &&
        !this.connectedToWorkerTerminal &&
        !this.terminalAttachRequested
      ) {
        this.attachSession();
      }
    };

    const outputListener = ({ chunk }: { chunk: string }) => {
      this.appendOutput(chunk);
    };

    const openedListener = () => {
      this.connectedToWorkerTerminal = true;
      this.terminalAttachRequested = false;
      this.updateStatus(this.vmStatus);

      this.getInput()?.focus();
    };

    const closedListener = () => {
      this.connectedToWorkerTerminal = false;
      this.terminalAttachRequested = false;

      this.updateStatus(this.vmStatus);
    };

    const errorListener = ({ error }: { error: string }) => {
      this.connectedToWorkerTerminal = false;
      this.terminalAttachRequested = false;
      this.vmStatus = {
        ...this.vmStatus,
        error: typeof error === "string" ? error : "WebVM terminal error",
      };

      this.updateStatus(this.vmStatus);
    };

    this.orchestrator.events.on("vm-status", statusListener);
    this.orchestrator.events.on("vm-terminal-output", outputListener);
    this.orchestrator.events.on("vm-terminal-opened", openedListener);
    this.orchestrator.events.on("vm-terminal-closed", closedListener);
    this.orchestrator.events.on("vm-terminal-error", errorListener);

    this.cleanups.push(() =>
      this.orchestrator?.events?.off?.("vm-status", statusListener),
    );

    this.cleanups.push(() =>
      this.orchestrator?.events?.off?.("vm-terminal-output", outputListener),
    );

    this.cleanups.push(() =>
      this.orchestrator?.events?.off?.("vm-terminal-opened", openedListener),
    );

    this.cleanups.push(() =>
      this.orchestrator?.events?.off?.("vm-terminal-closed", closedListener),
    );

    this.cleanups.push(() =>
      this.orchestrator?.events?.off?.("vm-terminal-error", errorListener),
    );

    this.vmStatus = this.orchestrator.getVMStatus?.() || this.vmStatus;
    this.updateStatus(this.vmStatus);
  }

  bindEventListeners() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelector('[data-role="composer"]')
      ?.addEventListener("submit", (event) => {
        event.preventDefault();
        this.runCommand();
      });

    root
      .querySelector('[data-action="clear"]')
      ?.addEventListener("click", () => this.clearOutput());

    root
      .querySelector('[data-action="interrupt"]')
      ?.addEventListener("click", () => this.interrupt());

    root
      .querySelector('[data-role="screen"]')
      ?.addEventListener("click", () => {
        const input = this.getInput();
        input?.focus();
      });

    root
      .querySelector('[data-role="screen"]')
      ?.addEventListener("scroll", () => this.handleScreenScroll());
  }

  bindResizeObserver() {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const screen = this.getScreen();
    if (!screen) {
      return;
    }

    this.screenResizeObserver = new ResizeObserver(() => {
      if (this.autoScrollEnabled) {
        this.scheduleAutoScroll();
      }
    });

    this.screenResizeObserver.observe(screen);
  }

  async startTerminal() {
    const status = this.vmStatus;

    if (!this.orchestrator) {
      this.updateStatus({
        ready: false,
        booting: false,
        bootAttempted: false,
        error: "Terminal bridge is unavailable.",
      });

      return;
    }

    if (status.ready) {
      this.attachSession();

      return;
    }

    if (status.error) {
      this.updateStatus(status);

      return;
    }

    if (!this.bootRequested) {
      this.bootRequested = true;
      this.attachSession();
    }

    if (!this.isConnected || !this.connectedToWorkerTerminal) {
      this.updateStatus(this.vmStatus);

      return;
    }

    this.attachSession();
  }

  attachSession() {
    if (this.connectedToWorkerTerminal || this.terminalAttachRequested) {
      return;
    }

    // Fresh boot attach should start with a clean terminal viewport.
    if (!this.vmStatus.ready) {
      this.clearOutput();
    }

    if (!this.orchestrator) {
      console.warn(
        "[ShadowClawTerminal] Cannot attach session: orchestrator not initialized.",
      );

      return;
    }

    this.terminalAttachRequested = true;
    this.orchestrator.openTerminalSession(orchestratorStore.activeGroupId);
  }

  runCommand() {
    const input = this.getInput();
    if (!input || !this.connectedToWorkerTerminal) {
      return;
    }

    const command = input.value;

    if (!command.trim()) {
      return;
    }

    this.orchestrator?.sendTerminalInput?.(`${command}\n`);
    input.value = "";
  }

  interrupt() {
    this.orchestrator?.sendTerminalInput?.("\u0003");
  }

  clearOutput() {
    const preservedPrompt =
      this.vmStatus.ready && this.connectedToWorkerTerminal
        ? extractLastPromptLine(this.outputBuffer)
        : "";

    this.outputBuffer = "";
    this.pendingEscape = "";
    this.autoScrollEnabled = true;

    if (preservedPrompt) {
      this.outputBuffer = preservedPrompt;
    }

    this.renderOutput();
  }

  appendOutput(chunk) {
    const result = normalizeTerminalText(
      this.outputBuffer,
      chunk,
      this.pendingEscape,
      {
        // During boot we prefer a stable transcript over VT100 erase semantics.
        // Some boot paths clear the screen repeatedly, which otherwise leaves the
        // visible panel blank even though boot text was received.
        respectEraseSequences: this.vmStatus.ready,
      },
    );
    this.outputBuffer = result.text;
    this.pendingEscape = result.pending;

    if (this.outputBuffer.length > MAX_OUTPUT_LENGTH) {
      this.outputBuffer = this.outputBuffer.slice(-MAX_OUTPUT_LENGTH);
    }

    this.renderOutput();
  }

  renderOutput() {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const output = root.querySelector('[data-role="output"]');
    const screen = root.querySelector('[data-role="screen"]');

    if (!(output instanceof HTMLElement) || !(screen instanceof HTMLElement)) {
      return;
    }

    output.textContent = this.outputBuffer;

    if (this.autoScrollEnabled) {
      this.scheduleAutoScroll();
    }
  }

  handleScreenScroll() {
    if (this.isApplyingAutoScroll) {
      return;
    }

    const screen = this.getScreen();
    if (!screen) {
      return;
    }

    this.autoScrollEnabled = isNearBottom(screen);
  }

  scheduleAutoScroll() {
    if (this.pendingAutoScrollFrame !== null) {
      cancelAnimationFrame(this.pendingAutoScrollFrame);
    }

    this.pendingAutoScrollFrame = requestAnimationFrame(() => {
      this.pendingAutoScrollFrame = null;
      this.scrollScreenToBottom();
    });
  }

  scrollScreenToBottom() {
    const screen = this.getScreen();
    if (!screen) {
      return;
    }

    this.isApplyingAutoScroll = true;
    screen.scrollTop = screen.scrollHeight;
    this.isApplyingAutoScroll = false;
    this.autoScrollEnabled = isNearBottom(screen);
  }

  getScreen() {
    const screen = this.shadowRoot?.querySelector('[data-role="screen"]');

    return screen instanceof HTMLElement ? screen : null;
  }

  updateStatus(status: VMStatusPayload) {
    const root = this.shadowRoot;
    if (!root) {
      return;
    }

    const statusEl = root.querySelector('[data-role="status"]');
    const input = this.getInput();
    const runButton = root.querySelector('[data-action="run"]');
    const interruptButton = root.querySelector('[data-action="interrupt"]');

    if (
      !(statusEl instanceof HTMLElement) ||
      !(runButton instanceof HTMLButtonElement) ||
      !(interruptButton instanceof HTMLButtonElement)
    ) {
      return;
    }

    if (status.ready) {
      statusEl.dataset.state = "ready";
      statusEl.textContent = this.connectedToWorkerTerminal
        ? "Connected to Alpine WebVM"
        : "WebVM ready. Connecting terminal...";
    } else if (status.error) {
      statusEl.dataset.state = "error";
      statusEl.textContent = `WebVM unavailable: ${status.error}`;
    } else {
      statusEl.dataset.state = "booting";
      statusEl.textContent = status.booting
        ? "Booting WebVM..."
        : "Waiting for WebVM...";
    }

    if (input instanceof HTMLInputElement) {
      input.disabled = !(status.ready && this.connectedToWorkerTerminal);
      input.placeholder =
        status.ready && this.connectedToWorkerTerminal
          ? "Type a shell command"
          : status.ready
            ? "Connecting to WebVM terminal..."
            : status.error
              ? "WebVM unavailable"
              : "Booting WebVM...";
    }

    runButton.disabled = !(status.ready && this.connectedToWorkerTerminal);
    interruptButton.disabled = !(
      status.ready && this.connectedToWorkerTerminal
    );
  }

  getInput() {
    const input = this.shadowRoot?.querySelector('[data-role="input"]');

    return input instanceof HTMLInputElement ? input : null;
  }
}

customElements.define("shadow-claw-terminal", ShadowClawTerminal);

function isNearBottom(screen: HTMLElement): boolean {
  const distanceToBottom =
    screen.scrollHeight - (screen.scrollTop + screen.clientHeight);

  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}

function extractLastPromptLine(text: string): string {
  if (!text) {
    return "";
  }

  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index] || "";
    if (/[#$](?:\s|$)/.test(line)) {
      return line;
    }
  }

  return "";
}

/**
 * Apply minimal terminal control character handling to the visible buffer.
 *
 * Returns the updated text and any trailing incomplete escape sequence to be
 * prepended to the next chunk (cross-chunk boundary handling).
 */
function normalizeTerminalText(
  current: string,
  chunk: string,
  pendingEscape = "",
  options: { respectEraseSequences?: boolean },
) {
  const respectEraseSequences = options?.respectEraseSequences ?? true;
  const input = pendingEscape + chunk;
  let next = current;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (char === "\u001b") {
      const escape = consumeEscapeSequence(input, index);

      if (escape.incomplete) {
        return { text: next, pending: input.slice(index) };
      }

      if (escape.action === "clear-screen" && respectEraseSequences) {
        next = "";
      }

      if (escape.action === "clear-line" && respectEraseSequences) {
        const lastLineBreak = next.lastIndexOf("\n");
        next = lastLineBreak === -1 ? "" : next.slice(0, lastLineBreak + 1);
      }

      index = escape.nextIndex - 1;

      continue;
    }

    if (char === "\r") {
      const nextChar = input[index + 1];

      if (nextChar === "\n") {
        // CRLF: skip the CR, let the LF be processed normally.

        continue;
      }

      if (nextChar !== undefined) {
        // Lone CR within the same chunk: cursor back to column 0,
        // overwriting the current line (e.g. shell prompt redraw).
        const lastLineBreak = next.lastIndexOf("\n");
        next = lastLineBreak === -1 ? "" : next.slice(0, lastLineBreak + 1);

        continue;
      }

      // CR at end of chunk — we can't tell yet whether it's CR or CRLF.
      // Defer it so the next chunk can resolve the ambiguity.

      return { text: next, pending: "\r" };
    }

    if (char === "\b" || char === "\u007f") {
      next = next.slice(0, -1);

      continue;
    }

    if ((char < " " && char !== "\n" && char !== "\t") || char === "\u0007") {
      continue;
    }

    next += char;
  }

  // Drop internal command protocol noise used by VM command execution.
  next = stripInternalVMNoise(next);

  return { text: next, pending: "" };
}

/**
 * Remove internal WebVM control markers and setup command echoes from the
 * visible terminal output. These are implementation details, not user output.
 */
function stripInternalVMNoise(text: string) {
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

function consumeEscapeSequence(text: string, startIndex: number) {
  const nextChar = text[startIndex + 1];

  if (nextChar === undefined) {
    return { action: "ignore", nextIndex: startIndex + 1, incomplete: true };
  }

  if (nextChar === "[") {
    let cursor = startIndex + 2;

    while (cursor < text.length) {
      const code = text.charCodeAt(cursor);

      if (code >= 0x40 && code <= 0x7e) {
        const finalChar = text[cursor];

        if (finalChar === "J") {
          return { action: "clear-screen", nextIndex: cursor + 1 };
        }

        if (finalChar === "K") {
          return { action: "clear-line", nextIndex: cursor + 1 };
        }

        return { action: "ignore", nextIndex: cursor + 1 };
      }

      cursor += 1;
    }

    return { action: "ignore", nextIndex: text.length, incomplete: true };
  }

  if (nextChar === "]") {
    let cursor = startIndex + 2;

    while (cursor < text.length) {
      const char = text[cursor];

      if (char === "\u0007") {
        return { action: "ignore", nextIndex: cursor + 1 };
      }

      if (char === "\u001b" && text[cursor + 1] === "\\") {
        return { action: "ignore", nextIndex: cursor + 2 };
      }

      cursor += 1;
    }

    return { action: "ignore", nextIndex: text.length, incomplete: true };
  }

  return {
    action: "ignore",
    nextIndex: Math.min(startIndex + 2, text.length),
  };
}
