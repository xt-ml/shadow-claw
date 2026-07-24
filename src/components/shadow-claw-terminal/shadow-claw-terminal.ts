import { orchestratorStore } from "../../stores/orchestrator.js";
import { VMStatusPayload } from "../../subsystems/worker/types.js";

import { extractLastPromptLine } from "./utils/extractLastPromptLine.js";
import { isNearBottom } from "./utils/isNearBottom.js";
import { normalizeTerminalText } from "./utils/normalizeTerminalText.js";

import ShadowClawElement from "../shadow-claw-element.js";
import shadowClawTerminalStyles from "./shadow-claw-terminal.css" with { type: "css" };
import shadowClawTerminalTemplate from "./shadow-claw-terminal.html" with { type: "html" };

export const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 12;
const MAX_OUTPUT_LENGTH = 80_000;
export class ShadowClawTerminal extends ShadowClawElement {
  static styles = shadowClawTerminalStyles;
  static template = shadowClawTerminalTemplate;

  autoScrollEnabled: boolean;
  bootRequested: boolean;
  connectedToWorkerTerminal: boolean;
  isApplyingAutoScroll: boolean;
  orchestrator: any | null;
  outputBuffer: string;
  pendingAutoScrollFrame: number | null;
  pendingEscape: string;
  screenResizeObserver: ResizeObserver | null;
  session: any | null;
  terminalAttachRequested: boolean;
  vmStatus: any;

  constructor() {
    super();

    this.session = null;
    this.outputBuffer = "";
    this.pendingEscape = "";
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

    super.disconnectedCallback();
    this.connectedToWorkerTerminal = false;
    this.terminalAttachRequested = false;
    this.orchestrator?.closeTerminalSession?.(orchestratorStore.activeGroupId);
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

    this.addCleanup(() =>
      this.orchestrator?.events?.off?.("vm-status", statusListener),
    );

    this.addCleanup(() =>
      this.orchestrator?.events?.off?.("vm-terminal-output", outputListener),
    );

    this.addCleanup(() =>
      this.orchestrator?.events?.off?.("vm-terminal-opened", openedListener),
    );

    this.addCleanup(() =>
      this.orchestrator?.events?.off?.("vm-terminal-closed", closedListener),
    );

    this.addCleanup(() =>
      this.orchestrator?.events?.off?.("vm-terminal-error", errorListener),
    );

    this.vmStatus = this.orchestrator.getVMStatus?.() || this.vmStatus;
    this.updateStatus(this.vmStatus);
  }

  getInput() {
    const input = this.shadowRoot?.querySelector('[data-role="input"]');

    return input instanceof HTMLInputElement ? input : null;
  }

  getScreen() {
    const screen = this.shadowRoot?.querySelector('[data-role="screen"]');

    return screen instanceof HTMLElement ? screen : null;
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

  interrupt() {
    this.orchestrator?.sendTerminalInput?.("\u0003");
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
}

customElements.define("shadow-claw-terminal", ShadowClawTerminal);
