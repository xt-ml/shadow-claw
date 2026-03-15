import { orchestratorStore } from "../stores/orchestrator.mjs";

const MAX_OUTPUT_LENGTH = 80_000;
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 12;

export class ShadowClawTerminal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /** @type {import("../vm.mjs").VMTerminalSession|null} */
    this.session = null;
    /** @type {string} */
    this.outputBuffer = "";
    /** @type {string} */
    this.pendingEscape = "";
    /** @type {Array<() => void>} */
    this.cleanups = [];
    /** @type {boolean} */
    this.bootRequested = false;
    /** @type {import("../orchestrator.mjs").Orchestrator|null} */
    this.orchestrator = null;
    /** @type {import("../vm.mjs").VMStatus} */
    this.vmStatus = {
      ready: false,
      booting: false,
      bootAttempted: false,
      error: null,
    };
    /** @type {boolean} */
    this.connectedToWorkerTerminal = false;
    /** @type {boolean} */
    this.terminalAttachRequested = false;
    /** @type {boolean} */
    this.autoScrollEnabled = true;
    /** @type {boolean} */
    this.isApplyingAutoScroll = false;
    /** @type {number|null} */
    this.pendingAutoScrollFrame = null;
    /** @type {ResizeObserver|null} */
    this.screenResizeObserver = null;
  }

  static getTemplate() {
    return `
      <style>
        /* Utility classes refactored from inline styles */
        .hidden, [hidden] {
          display: none !important;
        }

        :host {
          display: block;
        }

        .terminal {
          background:
            radial-gradient(circle at top, rgba(56, 189, 248, 0.14), transparent 45%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
          border: 0.0625rem solid rgba(148, 163, 184, 0.26);
          border-radius: 1rem;
          box-shadow:
            inset 0 0.0625rem 0 rgba(255, 255, 255, 0.05),
            0 1.25rem 2.5rem rgba(15, 23, 42, 0.18);
          color: #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 16rem;
          overflow: hidden;
          padding: 0.875rem;
        }

        .terminal__header {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .terminal__title-group {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.625rem;
        }

        .terminal__badge {
          background: rgba(14, 165, 233, 0.16);
          border: 0.0625rem solid rgba(56, 189, 248, 0.3);
          border-radius: 999px;
          color: #7dd3fc;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.08em;
          padding: 0.25rem 0.55rem;
          text-transform: uppercase;
        }

        .terminal__title {
          color: #f8fafc;
          font-size: 0.9375rem;
          font-weight: 600;
        }

        .terminal__status {
          color: #cbd5e1;
          font-size: 0.8125rem;
        }

        .terminal__status[data-state="ready"] {
          color: #86efac;
        }

        .terminal__status[data-state="booting"] {
          color: #fcd34d;
        }

        .terminal__status[data-state="error"] {
          color: #fca5a5;
        }

        .terminal__actions {
          display: flex;
          gap: 0.5rem;
        }

        .terminal__button {
          background: rgba(15, 23, 42, 0.8);
          border: 0.0625rem solid rgba(148, 163, 184, 0.22);
          border-radius: 0.625rem;
          color: #e2e8f0;
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.45rem 0.7rem;
        }

        .terminal__button:hover,
        .terminal__button:focus-visible {
          border-color: rgba(125, 211, 252, 0.45);
          outline: none;
        }

        .terminal__button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .terminal__screen {
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.84), rgba(2, 6, 23, 0.92));
          border-radius: 0.875rem;
          border: 0.0625rem solid rgba(51, 65, 85, 0.9);
          flex: 1;
          height: 11rem;
          max-height: 11rem;
          min-height: 11rem;
          overflow: auto;
          overflow: auto;
          padding: 0.875rem;
        }

        .terminal__output {
          color: #dbeafe;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          line-height: 1.5;
          margin: 0;
          min-height: 100%;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .terminal__composer {
          align-items: center;
          background: rgba(15, 23, 42, 0.72);
          border: 0.0625rem solid rgba(51, 65, 85, 0.95);
          border-radius: 0.875rem;
          display: grid;
          gap: 0.625rem;
          grid-template-columns: auto 1fr auto;
          padding: 0.625rem 0.75rem;
        }

        .terminal__prompt {
          color: #7dd3fc;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
        }

        .terminal__input {
          background: transparent;
          border: none;
          color: #f8fafc;
          font-family: var(--shadow-claw-font-mono);
          font-size: 0.8125rem;
          min-width: 0;
        }

        .terminal__input:disabled {
          color: #94a3b8;
        }

        .terminal__input:focus {
          outline: none;
        }

        .terminal__input::placeholder {
          color: #64748b;
        }

        .terminal__run {
          background: #0f766e;
          border: none;
          border-radius: 0.625rem;
          color: #f8fafc;
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.5rem 0.85rem;
        }

        .terminal__run:hover,
        .terminal__run:focus-visible {
          background: #0d9488;
          outline: none;
        }

        .terminal__run:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        @media (max-width: 47.99rem) {
          .terminal__header,
          .terminal__composer {
            grid-template-columns: 1fr;
          }

          .terminal__actions {
            width: 100%;
          }

          .terminal__button,
          .terminal__run {
            flex: 1;
          }

          .terminal__composer {
            align-items: stretch;
          }
        }
      </style>

      <section class="terminal" aria-label="WebVM terminal">
        <div class="terminal__header">
          <div class="terminal__title-group">
            <span class="terminal__badge">WebVM</span>
            <span class="terminal__title">Alpine Console</span>
            <span class="terminal__status" data-role="status" data-state="booting">Booting WebVM...</span>
          </div>
          <div class="terminal__actions">
            <button class="terminal__button" data-action="interrupt" type="button" disabled>Ctrl+C</button>
            <button class="terminal__button" data-action="clear" type="button">Clear</button>
          </div>
        </div>
        <div class="terminal__screen" data-role="screen">
          <pre class="terminal__output" data-role="output"></pre>
        </div>
        <form class="terminal__composer" data-role="composer">
          <span class="terminal__prompt">#</span>
          <input class="terminal__input" data-role="input" type="text" spellcheck="false" autocomplete="off" placeholder="Booting WebVM..." disabled />
          <button class="terminal__run" data-action="run" type="submit" disabled>Run</button>
        </form>
      </section>
    `;
  }

  connectedCallback() {
    this.render();
    this.renderOutput();
    this.bindEventListeners();
    this.bindResizeObserver();
    this.connectOrchestrator();
    void this.startTerminal();
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

    /** @param {import("../vm.mjs").VMStatus} status */
    const statusListener = (status) => {
      this.vmStatus = status;
      this.updateStatus(status);

      if (
        !status.error &&
        !this.connectedToWorkerTerminal &&
        !this.terminalAttachRequested
      ) {
        this.attachSession();
        return;
      }

      // After VM mode switches, the old terminal session is closed. Re-open
      // the bridge once the new VM reports ready.
      if (status.ready && !this.connectedToWorkerTerminal) {
        this.attachSession();
      }
    };
    /** @param {{chunk: string}} payload */
    const outputListener = ({ chunk }) => {
      if (typeof chunk === "string") {
        this.appendOutput(chunk);
      }
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
    /** @param {{error: string}} payload */
    const errorListener = ({ error }) => {
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

  render() {
    if (!this.shadowRoot) {
      return;
    }

    this.shadowRoot.innerHTML = ShadowClawTerminal.getTemplate();
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

    this.terminalAttachRequested = true;
    this.orchestrator?.openTerminalSession?.(orchestratorStore.activeGroupId);
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
    this.outputBuffer = "";
    this.pendingEscape = "";
    this.autoScrollEnabled = true;
    this.renderOutput();
  }

  /**
   * @param {string} chunk
   *
   * @returns {void}
   */
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

  /**
   * @param {import("../vm.mjs").VMStatus} status
   *
   * @returns {void}
   */
  updateStatus(status) {
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

/**
 * @param {HTMLElement} screen
 *
 * @returns {boolean}
 */
function isNearBottom(screen) {
  const distanceToBottom =
    screen.scrollHeight - (screen.scrollTop + screen.clientHeight);

  return distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX;
}

/**
 * Apply minimal terminal control character handling to the visible buffer.
 *
 * Returns the updated text and any trailing incomplete escape sequence to be
 * prepended to the next chunk (cross-chunk boundary handling).
 *
 * @param {string} current
 * @param {string} chunk
 * @param {string} [pendingEscape]
 * @param {{ respectEraseSequences?: boolean }} [options]
 *
 * @returns {{ text: string, pending: string }}
 */
function normalizeTerminalText(current, chunk, pendingEscape = "", options) {
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
 *
 * @param {string} text
 *
 * @returns {string}
 */
function stripInternalVMNoise(text) {
  const withoutInternalCommandEcho = text.replace(
    /(?:^|\n)[^\n]*mkdir -p \/workspace 2>&1; echo "?__BCDONE_\d+__\$\?"?[^\n]*(?:\n|$)/g,
    "\n",
  );

  const withoutMarkers = withoutInternalCommandEcho.replace(
    /(?:^|\n)\s*__BCDONE_\d+__(?:\d+|\$\?)?\s*(?:\n|$)/g,
    "\n",
  );

  return withoutMarkers.replace(/^\n+(?=\S)/, "");
}

/**
 * @param {string} text
 * @param {number} startIndex
 *
 * @returns {{ action: "ignore" | "clear-screen" | "clear-line", nextIndex: number, incomplete?: boolean }}
 */
function consumeEscapeSequence(text, startIndex) {
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
