/**
 * ShadowClaw — WebVM wrapper (v86-based Alpine Linux in WebAssembly)
 *
 * This module manages a lightweight Linux VM running inside a Web Worker.
 * The VM is booted eagerly when the worker starts and cached for reuse.
 * Commands require a ready VM and return explicit errors when unavailable.
 *
 * Implementation notes:
 * - Can use v86 (https://github.com/copy/v86.git) or compatible WASM emulator
 */

import { getWorkspaceDir } from "./storage/getWorkspaceDir.mjs";
import {
  BASH_DEFAULT_TIMEOUT_SEC,
  DEFAULT_VM_NETWORK_RELAY_URL,
} from "./config.mjs";

/**
 * @typedef {Object} VMResult
 *
 * @property {string} stdout
 * @property {string} stderr
 * @property {number} exitCode
 * @property {boolean} timedOut
 */

/**
 * @typedef {Object} VMInstance
 *
 * @property {() => boolean} isReady
 * @property {(command: string, timeoutSec: number) => Promise<VMResult>} execute
 * @property {() => any} getEmulator
 * @property {() => 'ext2' | '9p'} getMode
 * @property {() => (void|Promise<void>)} destroy
 */

/**
 * @typedef {Object} VMExecuteContext
 *
 * @property {import("./db/db.mjs").ShadowClawDatabase} db
 * @property {string} groupId
 */

/** @typedef {'disabled' | 'auto' | '9p' | 'ext2'} VMBootMode */

/**
 * @typedef {Object} VMStatus
 *
 * @property {boolean} ready
 * @property {boolean} booting
 * @property {boolean} bootAttempted
 * @property {string|null} error
 * @property {'ext2'|'9p'|null} [mode]
 */

/**
 * @typedef {Object} VMTerminalSession
 *
 * @property {() => void} close
 * @property {(data: string) => void} send
 */

/**
 * @typedef {Object} TerminalAutoSyncState
 *
 * @property {VMExecuteContext} context
 * @property {(() => void)|null} onFlushed
 * @property {string} recentOutput
 * @property {boolean} commandPending
 * @property {boolean} commandTouchesWorkspace
 * @property {boolean} cwdInWorkspace
 * @property {boolean} disposed
 * @property {() => void} flushSoon
 */

/** @type {VMInstance|null} */
let instance = null;
let booting = false;
let bootAttempted = false;

/** @type {Promise<void>|null} */
let bootPromise = null;

/** @type {number} */
let bootGeneration = 0;

/** @type {string|null} */
let lastBootError = null;

/** @type {any} */
let activeEmulator = null; // Track emulator for cleanup on failure

/** @type {'ext2' | '9p' | null} */
let activeMode = null;

/** @type {VMBootMode} */
let preferredBootMode = "disabled";

/** @type {string|null} */
let preferredBootHost = null;

/** @type {string|null} */
let active9pManifest = null;

/** @type {Set<(status: VMStatus) => void>} */
const statusListeners = new Set();

/** @type {'command'|'terminal'|null} */
let activeUsage = null;

/** @type {((byte: number) => void)|null} */
let terminalOutputListener = null;

let terminalOutputAttached = false;

let terminalSuspended = false;

/** @type {string} */
let pendingBootTranscript = "";

/** @type {string} */
let liveBootTranscript = "";

/** @type {Set<(chunk: string) => void>} */
const bootOutputListeners = new Set();

let suppressBootTranscriptReplay = false;

const VM_RUNTIME = typeof document === "undefined" ? "worker" : "ui";
const WEBVM_DISABLED_MESSAGE =
  "WebVM is disabled. Enable it in Settings to use WebVM.";
const VM_TIMEOUT_RECOVERY_MS = 5_000;
const VM_SHELL_PROMPT_NEEDLE = "# ";
const VM_WORKSPACE_SYNC_DEBOUNCE_MS = 200;
const VM_MISSING_FILE_DELETE_COOLDOWN_MS = 10_000;
const VM_MISSING_FILE_REQUIRED_PASSES = 3;
const VM_DELETE_WINDOW_MS = 60_000;
const VM_MAX_DELETES_PER_WINDOW = 25;
const VM_MAX_BOOT_TRANSCRIPT_LENGTH = 160_000;
const VM_HOST_SEEDED_FILE_PRUNE_GRACE_MS = 15_000;
const VM_TERMINAL_PROMPT_TAIL_LENGTH = 512;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const workspaceFlushTimers = new Map();

/** @type {Set<string>} */
const workspaceFlushInFlight = new Set();

/** @type {Map<string, number>} */
const missingFileDeleteRetryAt = new Map();

/** @type {Map<string, number>} */
const missingFileSeenCount = new Map();

/** @type {Map<string, number[]>} */
const groupDeletionTimestamps = new Map();

/** @type {Map<string, number>} */
const hostSeededFilePruneProtection = new Map();

/** @type {Map<string, Set<string>>} */
const vmObservedWorkspaceFilesByGroup = new Map();

/** @type {TerminalAutoSyncState|null} */
let terminalAutoSyncState = null;

/** @type {string} */
let preferredNetworkRelayURL = DEFAULT_VM_NETWORK_RELAY_URL;

/**
 * @param {number} bootToken
 *
 * @returns {boolean}
 */
function isCurrentBoot(bootToken) {
  return bootToken === bootGeneration;
}

/**
 * @returns {string}
 */
function getVMLogPrefix() {
  return `[WebVM:${VM_RUNTIME}]`;
}

/**
 * Destroy a v86 emulator instance while swallowing both sync throws and
 * async rejection paths from some v86 builds.
 *
 * @param {any} emulator
 *
 * @returns {Promise<void>}
 */
async function destroyEmulatorSafely(emulator) {
  if (!emulator?.destroy) {
    return;
  }

  try {
    await Promise.resolve(emulator.destroy());
  } catch (_) {
    /* ignore teardown failures */
  }
}

/**
 * Boot the VM. Idempotent — only boots once.
 * Called eagerly from the worker so the VM is ready by the time the user needs it.
 *
 * @returns {Promise<void>}
 */
export async function bootVM() {
  if (preferredBootMode === "disabled") {
    emitVMStatus();
    return;
  }

  if (instance?.isReady()) {
    return;
  }

  if (bootPromise) {
    return bootPromise;
  }

  if (bootAttempted) {
    // Only attempt boot once per page load
    return;
  }

  const bootToken = ++bootGeneration;

  bootAttempted = true;
  booting = true;

  emitVMStatus();

  bootPromise = (async () => {
    try {
      await doBootVM(bootToken);
    } finally {
      if (!isCurrentBoot(bootToken)) {
        return;
      }

      booting = false;
      bootPromise = null;

      emitVMStatus();
    }
  })();

  return bootPromise;
}

/**
 * Execute a command in the VM.
 *
 * Does NOT block on boot — if the VM isn't ready, returns an error immediately.
 *
 * @param {string} command
 * @param {number} [timeoutSec=BASH_DEFAULT_TIMEOUT_SEC]
 * @param {VMExecuteContext|null} [context=null]
 *
 * @returns {Promise<string>}
 */
export async function executeInVM(
  command,
  timeoutSec = BASH_DEFAULT_TIMEOUT_SEC,
  context = null,
) {
  if (!instance?.isReady()) {
    const status = getVMStatus();
    const detail = status.error
      ? `\nReason: ${status.error}`
      : status.booting
        ? "\nReason: VM is still booting in the background..."
        : "";

    return (
      "Error: WebVM is not available. The VM requires local assets " +
      "served at /assets/ (alpine-fs.json, libv86.mjs, etc). " +
      'Use the "javascript" tool for code execution, or the "fetch_url" tool for HTTP requests.' +
      detail
    );
  }

  if (activeUsage === "command") {
    return "Error: WebVM is currently busy running another command.";
  }

  let resumeTerminalWhenDone = false;
  const emulator = instance.getEmulator();

  if (activeUsage === "terminal") {
    terminalSuspended = true;
    detachActiveTerminalOutputListener(emulator);
    activeUsage = "command";
    resumeTerminalWhenDone = true;
  } else {
    activeUsage = "command";
  }

  try {
    if (instance.getMode() === "9p" && context && context.groupId) {
      try {
        await syncHostWorkspaceToVM(emulator, context);
      } catch (err) {
        console.warn("[WebVM] Failed to seed host workspace into 9p VM:", err);
      }
    }

    const result = await instance.execute(command, timeoutSec);

    if (instance.getMode() === "9p" && context && context.groupId) {
      // Run `sync` in the guest before reading the JS-side 9p FS.
      // The command may have left pending virtio-9p TWRITE/TCLUNK requests in
      // v86's virtio queue that haven't been processed by the JS 9p server yet
      // (the serial marker fires before the virtio queue drains). `sync` is a
      // blocking syscall from the guest's perspective — it only returns after
      // the kernel has fully flushed all pending I/O to every mounted FS,
      // which forces v86 to process those virtio-9p requests synchronously.
      // Without this, fs9p.read_dir() misses files written by the command.
      await instance.execute("sync", 10).catch(() => {});
      try {
        await syncVMWorkspaceToHost(emulator, context);
      } catch (err) {
        console.warn(
          "[WebVM] Failed to sync 9p VM workspace back to host:",
          err,
        );
      }
    }

    let output = "";
    if (result.stdout) {
      output += result.stdout;
    }

    if (result.stderr) {
      output += (output ? "\n" : "") + result.stderr;
    }

    if (result.timedOut) {
      output += "\n[command timed out]";
    }

    if (result.exitCode !== 0) {
      output += `\n[exit code: ${result.exitCode}]`;
    }

    return output || "(no output)";
  } finally {
    if (resumeTerminalWhenDone) {
      terminalSuspended = false;
      attachActiveTerminalOutputListener(emulator);
      activeUsage = terminalOutputListener ? "terminal" : null;
    } else if (activeUsage === "command") {
      activeUsage = null;
    }
  }
}

/**
 * Test-only helper to inject a ready VM instance without booting v86.
 *
 * @param {VMInstance|null} nextInstance
 *
 * @returns {void}
 */
export function __setVMInstanceForTests(nextInstance) {
  instance = nextInstance;
  activeEmulator = nextInstance?.getEmulator?.() ?? null;
  activeMode = nextInstance?.getMode?.() ?? null;
  booting = false;
  bootPromise = null;
  bootAttempted = !!nextInstance;
  lastBootError = null;
  activeUsage = null;
  terminalOutputListener = null;
  terminalOutputAttached = false;
  terminalSuspended = false;
  pendingBootTranscript = "";
  liveBootTranscript = "";
  bootOutputListeners.clear();
  suppressBootTranscriptReplay = false;
  terminalAutoSyncState = null;
  vmObservedWorkspaceFilesByGroup.clear();
}

/**
 * Shut down the VM and free resources.
 *
 * @returns {Promise<void>}
 */
export async function shutdownVM() {
  bootGeneration += 1;
  booting = false;
  bootAttempted = false;
  activeUsage = null;
  terminalOutputListener = null;
  terminalOutputAttached = false;
  terminalSuspended = false;
  pendingBootTranscript = "";
  liveBootTranscript = "";
  bootOutputListeners.clear();
  suppressBootTranscriptReplay = false;
  terminalAutoSyncState = null;
  const emulatorToDestroy = activeEmulator || instance?.getEmulator?.() || null;
  let destroyedViaInstance = false;

  if (instance?.destroy) {
    try {
      await Promise.resolve(instance.destroy());
      destroyedViaInstance = true;
    } catch {
      destroyedViaInstance = false;
    }
  }

  instance = null;
  bootPromise = null;
  lastBootError = null;
  activeMode = null;
  active9pManifest = null;
  workspaceFlushTimers.forEach((timer) => clearTimeout(timer));
  workspaceFlushTimers.clear();
  missingFileDeleteRetryAt.clear();
  missingFileSeenCount.clear();
  groupDeletionTimestamps.clear();
  hostSeededFilePruneProtection.clear();
  vmObservedWorkspaceFilesByGroup.clear();

  activeEmulator = null;
  if (!destroyedViaInstance) {
    await destroyEmulatorSafely(emulatorToDestroy);
  }

  emitVMStatus();
}

/**
 * Check if the VM is booted and ready for commands.
 *
 * @returns {boolean}
 */
export function isVMReady() {
  return instance?.isReady() ?? false;
}

/**
 * Get the current VM status snapshot.
 *
 * @returns {VMStatus}
 */
export function getVMStatus() {
  return {
    ready: instance?.isReady() ?? false,
    booting,
    bootAttempted,
    mode: activeMode,
    error:
      preferredBootMode === "disabled" ? WEBVM_DISABLED_MESSAGE : lastBootError,
  };
}

/**
 * Set preferred boot mode. Use `auto` for fallback behavior.
 *
 * @param {VMBootMode} mode
 *
 * @returns {void}
 */
export function setVMBootModePreference(mode) {
  if (
    mode !== "disabled" &&
    mode !== "auto" &&
    mode !== "9p" &&
    mode !== "ext2"
  ) {
    return;
  }

  preferredBootMode = mode;

  if (mode !== "disabled" && lastBootError === WEBVM_DISABLED_MESSAGE) {
    lastBootError = null;
  }

  emitVMStatus();
}

/**
 * @returns {VMBootMode}
 */
export function getVMBootModePreference() {
  return preferredBootMode;
}

/**
 * Set preferred boot host for VM asset lookup.
 * Pass null/empty to use deployment-derived defaults.
 *
 * @param {string|null|undefined} bootHost
 *
 * @returns {void}
 */
export function setVMBootHostPreference(bootHost) {
  preferredBootHost = normalizeBootHost(bootHost);
}

/**
 * @returns {string|null}
 */
export function getVMBootHostPreference() {
  return preferredBootHost;
}

/**
 * Set preferred network relay URL used by the VM NIC.
 * Pass null/empty to use default.
 *
 * @param {string|null|undefined} relayUrl
 *
 * @returns {void}
 */
export function setVMNetworkRelayURLPreference(relayUrl) {
  preferredNetworkRelayURL =
    normalizeRelayURL(relayUrl) || DEFAULT_VM_NETWORK_RELAY_URL;
}

/**
 * @returns {string}
 */
export function getVMNetworkRelayURLPreference() {
  return preferredNetworkRelayURL;
}

/**
 * @param {string|null|undefined} bootHost
 *
 * @returns {string|null}
 */
function normalizeBootHost(bootHost) {
  if (typeof bootHost !== "string") {
    return null;
  }

  const trimmed = bootHost.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.href.replace(/\/+$/, "");
  } catch (_) {
    console.warn("[WebVM] Ignoring invalid VM boot host:", bootHost);
    return null;
  }
}

/**
 * @returns {string}
 */
function getDefaultBootHost() {
  return new URL("..", import.meta.url).href.replace(/\/+$/, "");
}

/**
 * @param {string|null|undefined} relayUrl
 *
 * @returns {string|null}
 */
function normalizeRelayURL(relayUrl) {
  if (typeof relayUrl !== "string") {
    return null;
  }

  const trimmed = relayUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      throw new Error("Relay URL must use ws:// or wss://");
    }

    return parsed.href;
  } catch (_) {
    console.warn("[WebVM] Ignoring invalid VM relay URL:", relayUrl);
    return null;
  }
}

/**
 * Subscribe to VM status updates.
 *
 * @param {(status: VMStatus) => void} listener
 *
 * @returns {() => void}
 */
export function subscribeVMStatus(listener) {
  statusListeners.add(listener);
  listener(getVMStatus());

  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Create a serial terminal session connected to the running VM.
 *
 * @param {(chunk: string) => void} onOutput
 *
 * @returns {VMTerminalSession}
 */
export function createTerminalSession(onOutput) {
  if (!instance?.isReady()) {
    throw new Error("WebVM is not ready.");
  }

  if (activeUsage === "command") {
    throw new Error("WebVM is busy running a command.");
  }

  if (activeUsage === "terminal") {
    throw new Error("WebVM terminal is already attached.");
  }

  const emulator = instance.getEmulator();

  if (!emulator?.add_listener || !emulator?.remove_listener) {
    throw new Error("WebVM serial interface is unavailable.");
  }

  /** @param {number} byte */
  const listener = (byte) => {
    if (terminalSuspended) {
      return;
    }

    const chunk = String.fromCharCode(byte);
    onOutput(chunk);
    recordTerminalAutoSyncOutput(chunk);
  };

  if (pendingBootTranscript && !suppressBootTranscriptReplay) {
    onOutput(pendingBootTranscript);
  }

  pendingBootTranscript = "";
  suppressBootTranscriptReplay = false;

  activeUsage = "terminal";
  terminalSuspended = false;
  terminalOutputListener = listener;
  attachActiveTerminalOutputListener(emulator);

  return {
    close() {
      if (terminalOutputListener === listener) {
        detachActiveTerminalOutputListener(emulator);
        terminalOutputListener = null;
        terminalOutputAttached = false;
        terminalSuspended = false;
      }

      if (activeUsage === "terminal") {
        activeUsage = null;
      }
    },
    send(data) {
      if (terminalSuspended) {
        return;
      }

      recordTerminalAutoSyncInput(data);
      emulator.serial0_send(data);
    },
  };
}

/**
 * Subscribe to raw serial boot output while the VM is booting.
 * The listener receives chunks exactly as seen on ttyS0.
 *
 * @param {(chunk: string) => void} onOutput
 *
 * @returns {() => void}
 */
export function subscribeVMBootOutput(onOutput) {
  const snapshot = liveBootTranscript || pendingBootTranscript;

  if (snapshot) {
    onOutput(snapshot);
    // The listener already got a transcript snapshot, so avoid replaying it
    // again when the interactive terminal session attaches.
    suppressBootTranscriptReplay = true;
  }

  bootOutputListeners.add(onOutput);

  return () => {
    bootOutputListeners.delete(onOutput);
  };
}

/**
 * Test-only helper to seed pending boot transcript behavior.
 *
 * @param {string} transcript
 * @param {boolean} [suppressReplay=false]
 *
 * @returns {void}
 */
export function __setBootTranscriptForTests(
  transcript,
  suppressReplay = false,
) {
  pendingBootTranscript = typeof transcript === "string" ? transcript : "";
  liveBootTranscript = "";
  suppressBootTranscriptReplay = !!suppressReplay;
}

/**
 * Ensure /workspace in the running 9p VM reflects host storage contents.
 *
 * @param {VMExecuteContext} context
 *
 * @returns {Promise<void>}
 */
export async function syncVMWorkspaceFromHost(context) {
  if (!instance?.isReady() || instance.getMode() !== "9p") {
    return;
  }

  await syncHostWorkspaceToVM(instance.getEmulator(), context);
}

/**
 * Attach a debounced 9p write listener for an active terminal session.
 *
 * @param {VMExecuteContext} context
 * @param {(() => void)|null} [onFlushed=null]
 *
 * @returns {(() => void)|null}
 */
export function attachTerminalWorkspaceAutoSync(context, onFlushed = null) {
  if (!instance?.isReady() || instance.getMode() !== "9p") {
    return null;
  }

  const emulator = instance.getEmulator();

  if (!emulator?.add_listener || !emulator?.remove_listener) {
    return null;
  }

  const groupId = context.groupId;

  /** @type {TerminalAutoSyncState} */
  const state = {
    context,
    onFlushed,
    recentOutput: "",
    commandPending: false,
    commandTouchesWorkspace: false,
    cwdInWorkspace: false,
    disposed: false,
    flushSoon: () => scheduleTerminalWorkspaceFlush(state),
  };

  // Ignore idle/background 9p writes (for example boot-time daemons) so
  // auto-sync is driven by interactive terminal commands only.
  const onNinePWriteEnd = () => {
    if (terminalAutoSyncState !== state || state.disposed) {
      return;
    }

    if (!state.commandPending || !state.commandTouchesWorkspace) {
      return;
    }

    state.flushSoon();
  };

  terminalAutoSyncState = state;
  emulator.add_listener("9p-write-end", onNinePWriteEnd);

  return () => {
    if (terminalAutoSyncState === state) {
      terminalAutoSyncState = null;
    }

    state.disposed = true;
    state.commandPending = false;
    state.recentOutput = "";

    emulator.remove_listener("9p-write-end", onNinePWriteEnd);
    const timer = workspaceFlushTimers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      workspaceFlushTimers.delete(groupId);
    }

    workspaceFlushInFlight.delete(groupId);
  };
}

/**
 * Sync /workspace files from the VM into host storage.
 *
 * Call this after interactive terminal sessions to surface any files the user
 * created or modified directly in the VM shell.
 *
 * @param {VMExecuteContext} context
 *
 * @returns {Promise<void>}
 */
export async function flushVMWorkspaceToHost(context) {
  if (!instance?.isReady() || instance.getMode() !== "9p") {
    return;
  }

  try {
    await syncVMWorkspaceToHost(instance.getEmulator(), context);
  } catch (err) {
    console.warn("[WebVM] Failed to flush VM workspace to host:", err);
  }
}

/**
 * @param {number} bootToken
 *
 * Boot the VM (internal implementation)
 *
 * @returns {Promise<void>}
 */
async function doBootVM(bootToken) {
  /** @type {any} */
  let emulator = null;

  try {
    pendingBootTranscript = "";
    suppressBootTranscriptReplay = false;

    console.log(`${getVMLogPrefix()} Starting boot - checking assets...`);

    const bootConfig = await resolveBootConfig();
    if (!isCurrentBoot(bootToken)) {
      return;
    }

    if (!bootConfig) {
      const msg =
        "Assets not found. Checked 9p flat manifest assets at /assets/v86.9pfs/ and ext2 assets at /assets/v86.ext2/.";

      console.warn(
        `${getVMLogPrefix()} ${msg} Bash tool execution is unavailable.`,
      );

      lastBootError = msg;

      return;
    }

    activeMode = bootConfig.mode;
    active9pManifest = bootConfig.mode === "9p" ? bootConfig.basefsUrl : null;

    console.log(
      `${getVMLogPrefix()} Using ${bootConfig.mode} boot mode (${bootConfig.label}). Loading v86 module...`,
    );

    // Dynamically import v86
    let V86;
    try {
      // Use local v86 module from assets
      // @ts-ignore
      const v86Module = await import(bootConfig.libUrl);
      if (!isCurrentBoot(bootToken)) {
        return;
      }

      V86 = v86Module.V86 || v86Module.default;

      if (!V86) {
        console.error(
          `${getVMLogPrefix()} ${bootConfig.libUrl} loaded but V86 constructor not found. Exports:`,
          Object.keys(v86Module),
        );

        lastBootError = `V86 constructor not found in ${bootConfig.libUrl}`;

        return;
      }
    } catch (err) {
      if (!isCurrentBoot(bootToken)) {
        return;
      }

      console.error(
        `${getVMLogPrefix()} Failed to import ${bootConfig.libUrl}:`,
        err,
      );

      lastBootError = `Failed to import ${bootConfig.libUrl}: ${err instanceof Error ? err.message : String(err)}`;

      return;
    }

    console.log(`${getVMLogPrefix()} v86 module loaded. Creating emulator...`);

    // Boot emulator in headless mode
    emulator = new V86({
      wasm_path: bootConfig.wasmUrl,
      memory_size: 512 * 1024 * 1024, // 512 MB
      // Attach a NIC to a relay backend so guest DHCP works.
      net_device: {
        type: "virtio",
        relay_url: preferredNetworkRelayURL,
      },
      bios: { url: bootConfig.biosUrl },
      vga_bios: { url: bootConfig.vgaBiosUrl },
      ...(bootConfig.mode === "ext2"
        ? {
            bzimage: { url: bootConfig.bzImageUrl },
            initrd: { url: bootConfig.initrdUrl },
            hda: { url: bootConfig.ext2Url, async: true },
            cmdline:
              "rw root=LABEL=alpineroot rootfstype=ext4 tsc=reliable console=ttyS0 fsck.mode=skip rootdelay=1",
          }
        : {
            filesystem: {
              basefs: bootConfig.basefsUrl,
              ...(bootConfig.baseurl ? { baseurl: bootConfig.baseurl } : {}),
            },
            // 9p virtio root (host9p) per v86 docs.
            cmdline:
              "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=none,version=9p2000.L tsc=reliable console=ttyS0 fsck.mode=skip rootdelay=1 intel_pstate=disable",
            bzimage_initrd_from_filesystem: true,
          }),
      autostart: true,
      disable_keyboard: true,
      disable_mouse: true,
      disable_speaker: true,
      serial_container: null,
    });

    // Track the emulator for cleanup
    activeEmulator = emulator;

    if (!isCurrentBoot(bootToken)) {
      await destroyEmulatorSafely(emulator);

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    console.log(
      `${getVMLogPrefix()} Emulator created. Waiting for login prompt (600s timeout)...`,
    );

    // Log serial output during boot for debugging
    /** @type {string} */
    let bootLog = "";
    liveBootTranscript = "";

    /** @param {number} byte */
    const bootLogger = (byte) => {
      const ch = String.fromCharCode(byte);

      liveBootTranscript += ch;
      if (liveBootTranscript.length > VM_MAX_BOOT_TRANSCRIPT_LENGTH) {
        liveBootTranscript = liveBootTranscript.slice(
          -VM_MAX_BOOT_TRANSCRIPT_LENGTH,
        );
      }

      if (bootOutputListeners.size > 0) {
        // Only suppress replay when live boot bytes were actually delivered.
        suppressBootTranscriptReplay = true;
        bootOutputListeners.forEach((listener) => {
          try {
            listener(ch);
          } catch {
            /* ignore boot listener failures */
          }
        });
      }

      bootLog += ch;

      if (ch === "\n") {
        const line = bootLog.trimEnd();

        if (line) console.log(`${getVMLogPrefix()} [boot]`, line);

        bootLog = "";
      }
    };

    if (emulator.add_listener) {
      emulator.add_listener("serial0-output-byte", bootLogger);
    }

    // Wait for shell prompt — 9p boot from chunks is slow, allow 600s
    await waitForSerial(emulator, "login:", 600_000);
    if (!isCurrentBoot(bootToken)) {
      await destroyEmulatorSafely(emulator);

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    console.log(`${getVMLogPrefix()} Got login prompt...`);

    emulator.serial0_send("root\n");

    await waitForSerial(emulator, "# ", 60000);
    if (!isCurrentBoot(bootToken)) {
      await destroyEmulatorSafely(emulator);

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    // Remove boot logger after reaching interactive root shell prompt.
    if (emulator.remove_listener) {
      emulator.remove_listener("serial0-output-byte", bootLogger);
    }

    if (liveBootTranscript) {
      pendingBootTranscript = liveBootTranscript;
    }

    if (bootConfig.mode === "9p") {
      await executeCommand(emulator, "mkdir -p /workspace", 20);
      if (!isCurrentBoot(bootToken)) {
        await destroyEmulatorSafely(emulator);

        if (activeEmulator === emulator) {
          activeEmulator = null;
        }

        return;
      }
    }

    instance = {
      isReady: () => true,
      getEmulator: () => emulator,
      getMode: () => bootConfig.mode,
      destroy: async () => {
        instance = null;
        if (activeEmulator === emulator) {
          activeEmulator = null;
        }

        await destroyEmulatorSafely(emulator);
      },
      execute: (cmd, timeout) => executeCommand(emulator, cmd, timeout),
    };

    activeEmulator = emulator; // Keep reference for cleanup

    console.log(
      `${getVMLogPrefix()} WebVM booted successfully (${bootConfig.mode})`,
    );

    lastBootError = null;
    emitVMStatus();
  } catch (err) {
    if (!isCurrentBoot(bootToken)) {
      if (emulator) {
        await destroyEmulatorSafely(emulator);
      }

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    const msg = err instanceof Error ? err.message : String(err);

    console.error(`${getVMLogPrefix()} Failed to boot WebVM:`, msg);

    lastBootError = msg;

    // CRITICAL: Destroy the emulator on failure to stop it from fetching more chunks
    if (emulator) {
      console.log(
        `${getVMLogPrefix()} Destroying emulator to stop chunk downloads...`,
      );

      await destroyEmulatorSafely(emulator);

      activeEmulator = null;
    }

    console.warn(`${getVMLogPrefix()} Bash tool execution is unavailable.`);

    emitVMStatus();
  }
}

/**
 * @returns {Promise<
 *   | {
 *       mode: '9p';
 *       label: string;
 *       libUrl: string;
 *       wasmUrl: string;
 *       biosUrl: string;
 *       vgaBiosUrl: string;
 *       basefsUrl: string;
 *       baseurl: string | null;
 *     }
 *   | {
 *       mode: 'ext2';
 *       label: string;
 *       libUrl: string;
 *       wasmUrl: string;
 *       biosUrl: string;
 *       vgaBiosUrl: string;
 *       ext2Url: string;
 *       bzImageUrl: string;
 *       initrdUrl: string;
 *     }
 *   | null
 * >}
 */
async function resolveBootConfig() {
  const bootHost = preferredBootHost || getDefaultBootHost();
  const ext2Root = `${bootHost}/assets/v86.ext2`;
  const ninePRoot = `${bootHost}/assets/v86.9pfs`;

  const ext2Ok = await assetsExist([
    `${ext2Root}/libv86.mjs`,
    `${ext2Root}/v86.wasm`,
    `${ext2Root}/seabios.bin`,
    `${ext2Root}/vgabios.bin`,
    `${ext2Root}/alpine-rootfs.ext2`,
    `${ext2Root}/bzImage`,
    `${ext2Root}/initrd`,
  ]);

  const shared9pOk = await assetsExist([
    `${ninePRoot}/libv86.mjs`,
    `${ninePRoot}/v86.wasm`,
    `${ninePRoot}/seabios.bin`,
    `${ninePRoot}/vgabios.bin`,
  ]);

  const flatManifestUrl = `${ninePRoot}/alpine-fs.json`;
  const ninePOk = shared9pOk && (await assetExists(flatManifestUrl));

  const ext2Config = {
    mode: /** @type {'ext2'} */ ("ext2"),
    label: "ext2/hda",
    libUrl: `${ext2Root}/libv86.mjs`,
    wasmUrl: `${ext2Root}/v86.wasm`,
    biosUrl: `${ext2Root}/seabios.bin`,
    vgaBiosUrl: `${ext2Root}/vgabios.bin`,
    ext2Url: `${ext2Root}/alpine-rootfs.ext2`,
    bzImageUrl: `${ext2Root}/bzImage`,
    initrdUrl: `${ext2Root}/initrd`,
  };

  const ninePConfig = {
    mode: /** @type {'9p'} */ ("9p"),
    label: "9p/virtfs (flat)",
    libUrl: `${ninePRoot}/libv86.mjs`,
    wasmUrl: `${ninePRoot}/v86.wasm`,
    biosUrl: `${ninePRoot}/seabios.bin`,
    vgaBiosUrl: `${ninePRoot}/vgabios.bin`,
    basefsUrl: flatManifestUrl,
    baseurl: `${ninePRoot}/alpine-rootfs-flat/`,
  };

  // Explicit mode selection must be honored even if both asset sets exist.
  if (preferredBootMode === "ext2") {
    if (ext2Ok) {
      console.log("[WebVM boot] Mode 1: ext2 forced and assets found");
      return ext2Config;
    }

    console.log(
      "[WebVM boot] Mode 2: ext2 forced but assets not found, skipping boot",
    );
    return null;
  }

  if (preferredBootMode === "9p") {
    if (ninePOk) {
      console.log("[WebVM boot] Mode 1: 9p forced and assets found");
      return ninePConfig;
    }

    console.log(
      "[WebVM boot] Mode 2: 9p forced but flat manifest assets not found, skipping boot",
    );
    return null;
  }

  if (ext2Ok) {
    console.log(
      "[WebVM boot] Mode 3: ext2 with all assets found - preferred auto fallback",
    );

    return ext2Config;
  }

  if (ninePOk) {
    console.log(
      "[WebVM boot] Mode 4: 9p with flat manifest - fallback boot path",
    );

    return ninePConfig;
  }

  console.log(
    "[WebVM boot] Mode 5: no bootable ext2 or 9p assets found, skipping boot",
  );

  return null;
}

/**
 * Test-only helper for boot config selection logic.
 *
 * @returns {ReturnType<typeof resolveBootConfig>}
 */
export function __resolveBootConfigForTests() {
  return resolveBootConfig();
}

/**
 * @param {string} url
 *
 * @returns {Promise<boolean>}
 */
async function assetExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });

    return !!res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {string[]} urls
 *
 * @returns {Promise<boolean>}
 */
async function assetsExist(urls) {
  const checks = await Promise.all(urls.map((url) => assetExists(url)));
  return checks.every(Boolean);
}

/**
 * @param {any} emulator
 * @param {VMExecuteContext} context
 *
 * @returns {Promise<void>}
 */
async function syncHostWorkspaceToVM(emulator, context) {
  const { db, groupId } = context;

  const workspaceDir = await getWorkspaceDir(db, groupId);
  const fs9p = emulator?.fs9p;

  // Ensure the mountpoint exists even if a previous boot did not finish setup.
  if (!vmPathExists(fs9p, "/workspace")) {
    await runInternalVMCommand(emulator, "mkdir -p /workspace", 20).catch(
      () => {
        /* best effort */
      },
    );
  }

  /** @type {string[]} */
  const hostFiles = [];
  await collectWorkspaceFiles(workspaceDir, "", hostFiles);

  /** @type {Set<string>} */
  const hostFileSet = new Set(hostFiles);

  /** @type {Set<string>} */
  const ensuredDirs = new Set();

  if (fs9p?.read_dir) {
    /** @type {string[]} */
    const vmFiles = [];
    try {
      collectVMFiles(fs9p, "/workspace", "", vmFiles);
      recordObservedVMWorkspaceFiles(groupId, vmFiles);
    } catch {
      // If /workspace cannot be enumerated yet, skip pruning for this pass.
    }

    for (const relPath of vmFiles) {
      const missingFileKey = `${groupId}:${relPath}`;

      if (hostFileSet.has(relPath)) {
        missingFileDeleteRetryAt.delete(missingFileKey);
        missingFileSeenCount.delete(missingFileKey);

        continue;
      }

      if (shouldIgnoreWorkspaceSyncPath(relPath)) {
        continue;
      }

      const now = Date.now();
      const retryAt = missingFileDeleteRetryAt.get(missingFileKey) || 0;
      if (retryAt > now) {
        continue;
      }

      const missingCount = (missingFileSeenCount.get(missingFileKey) || 0) + 1;
      missingFileSeenCount.set(missingFileKey, missingCount);
      if (missingCount < VM_MISSING_FILE_REQUIRED_PASSES) {
        continue;
      }

      if (!canAttemptAutoDeletion(groupId, now)) {
        continue;
      }

      await runInternalVMCommand(
        emulator,
        `rm -f ${quoteShellPath(`/workspace/${relPath}`)}`,
        20,
      );

      registerAutoDeletion(groupId, now);

      missingFileDeleteRetryAt.set(
        missingFileKey,
        now + VM_MISSING_FILE_DELETE_COOLDOWN_MS,
      );
    }
  }

  for (const relPath of hostFiles) {
    if (shouldIgnoreWorkspaceSyncPath(relPath)) {
      continue;
    }

    const dirPath = relPath.includes("/")
      ? relPath.slice(0, relPath.lastIndexOf("/"))
      : "";

    if (dirPath && !ensuredDirs.has(dirPath)) {
      ensuredDirs.add(dirPath);
      await runInternalVMCommand(
        emulator,
        `mkdir -p ${quoteShellPath(`/workspace/${dirPath}`)}`,
        20,
      );
    }

    let bytes = null;
    try {
      bytes = await readWorkspaceFileBytes(workspaceDir, relPath);
    } catch (err) {
      if (isMissingFileError(err)) {
        continue;
      }

      throw err;
    }

    if (!bytes) {
      continue;
    }

    const vmPath = `/workspace/${relPath}`;
    const existingBytes = await readVMFileBytes(emulator, vmPath);
    if (existingBytes && byteArraysEqual(existingBytes, bytes)) {
      continue;
    }

    protectHostSeededFileFromPrune(groupId, relPath);

    // create_file writes directly into fs9p without serial/base64 overhead.
    await emulator.create_file(vmPath, bytes);
  }
}

/**
 * @param {unknown} err
 *
 * @returns {boolean}
 */
function isMissingFileError(err) {
  if (!err || typeof err !== "object") {
    return false;
  }

  const candidate = /** @type {{ name?: unknown, message?: unknown }} */ (err);
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";

  return name === "NotFoundError" || /file\s+not\s+found/i.test(message);
}

/**
 * @param {any} emulator
 * @param {VMExecuteContext} context
 *
 * @returns {Promise<void>}
 */
async function syncVMWorkspaceToHost(emulator, context) {
  const fs9p = emulator?.fs9p;
  if (!fs9p?.read_dir) {
    return;
  }

  const workspaceDir = await getWorkspaceDir(context.db, context.groupId);

  /** @type {string[]} */
  const vmFiles = [];
  collectVMFiles(fs9p, "/workspace", "", vmFiles);
  recordObservedVMWorkspaceFiles(context.groupId, vmFiles);

  /** @type {Set<string>} */
  const vmFileSet = new Set(vmFiles);

  /** @type {string[]} */
  const hostFiles = [];
  await collectWorkspaceFiles(workspaceDir, "", hostFiles);

  // Mirror VM-side deletions into host storage so `rm` in the terminal
  // persists and does not get reintroduced by later host->VM reseeds.
  for (const relPath of hostFiles) {
    if (shouldIgnoreWorkspaceSyncPath(relPath)) {
      continue;
    }

    if (vmFileSet.has(relPath)) {
      clearHostSeededFilePruneProtection(context.groupId, relPath);

      continue;
    }

    if (!wasWorkspaceFileObservedInVM(context.groupId, relPath)) {
      continue;
    }

    if (isHostSeededFilePruneProtected(context.groupId, relPath)) {
      continue;
    }

    await deleteWorkspaceFile(workspaceDir, relPath);
  }

  for (const relPath of vmFiles) {
    if (shouldIgnoreWorkspaceSyncPath(relPath)) {
      continue;
    }

    const data = await emulator.read_file(`/workspace/${relPath}`);
    if (!data) {
      continue;
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    let currentBytes = null;
    try {
      currentBytes = await readWorkspaceFileBytes(workspaceDir, relPath);
    } catch (err) {
      if (!isMissingFileError(err)) {
        throw err;
      }
    }

    if (currentBytes && byteArraysEqual(currentBytes, bytes)) {
      continue;
    }

    await writeWorkspaceFileBytes(workspaceDir, relPath, bytes);
  }
}

/**
 * @param {string} groupId
 * @param {string[]} relPaths
 *
 * @returns {void}
 */
function recordObservedVMWorkspaceFiles(groupId, relPaths) {
  if (!groupId || !Array.isArray(relPaths) || relPaths.length === 0) {
    return;
  }

  let observed = vmObservedWorkspaceFilesByGroup.get(groupId);
  if (!observed) {
    observed = new Set();
    vmObservedWorkspaceFilesByGroup.set(groupId, observed);
  }

  for (const relPath of relPaths) {
    if (!relPath || shouldIgnoreWorkspaceSyncPath(relPath)) {
      continue;
    }

    observed.add(relPath);
  }
}

/**
 * @param {string} groupId
 * @param {string} relPath
 *
 * @returns {boolean}
 */
function wasWorkspaceFileObservedInVM(groupId, relPath) {
  if (!groupId || !relPath) {
    return false;
  }

  const observed = vmObservedWorkspaceFilesByGroup.get(groupId);
  return observed ? observed.has(relPath) : false;
}

/**
 * @param {FileSystemDirectoryHandle} dir
 * @param {string} prefix
 * @param {string[]} out
 *
 * @returns {Promise<void>}
 */
async function collectWorkspaceFiles(dir, prefix, out) {
  // @ts-ignore - entries() is available in workers for FileSystemDirectoryHandle.
  for await (const [name, handle] of dir.entries()) {
    if (name === ".git") {
      continue;
    }

    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === "directory") {
      await collectWorkspaceFiles(handle, rel, out);
    } else {
      if (shouldIgnoreWorkspaceSyncPath(rel)) {
        continue;
      }

      out.push(rel);
    }
  }
}

/**
 * @param {any} fs9p
 * @param {string} vmPath
 *
 * @returns {boolean}
 */
function vmPathExists(fs9p, vmPath) {
  if (!fs9p?.SearchPath) {
    return false;
  }

  const result = fs9p.SearchPath(vmPath);
  return !!result && result.id !== -1;
}

/**
 * @param {any} fs9p
 * @param {string} vmDir
 * @param {string} prefix
 * @param {string[]} out
 *
 * @returns {void}
 */
function collectVMFiles(fs9p, vmDir, prefix, out) {
  const names = fs9p.read_dir(vmDir);
  if (!Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    const vmPath = `${vmDir}/${name}`.replace(/\/+/g, "/");
    const rel = prefix ? `${prefix}/${name}` : name;

    // Use SearchPath + IsDirectory to distinguish files from directories.
    // read_dir() alone is not sufficient: it returns [] for both empty
    // directories AND regular files (whose direntries Map is always empty).
    const p = fs9p.SearchPath(vmPath);
    if (p.id === -1) {
      continue;
    }

    if (fs9p.IsDirectory(p.id)) {
      collectVMFiles(fs9p, vmPath, rel, out);
    } else {
      out.push(rel);
    }
  }
}

/**
 * @param {FileSystemDirectoryHandle} workspaceDir
 * @param {string} relPath
 *
 * @returns {Promise<Uint8Array|null>}
 */
async function readWorkspaceFileBytes(workspaceDir, relPath) {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const filename = segments.pop();
  let dir = workspaceDir;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment);
  }

  if (!filename) {
    return null;
  }

  const fileHandle = await dir.getFileHandle(filename);
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();

  return new Uint8Array(buffer);
}

/**
 * @param {any} emulator
 * @param {string} vmPath
 *
 * @returns {Promise<Uint8Array|null>}
 */
async function readVMFileBytes(emulator, vmPath) {
  try {
    const data = await emulator.read_file(vmPath);
    if (!data) {
      return null;
    }

    return data instanceof Uint8Array ? data : new Uint8Array(data);
  } catch {
    return null;
  }
}

/**
 * @param {FileSystemDirectoryHandle} workspaceDir
 * @param {string} relPath
 * @param {Uint8Array} bytes
 *
 * @returns {Promise<void>}
 */
async function writeWorkspaceFileBytes(workspaceDir, relPath, bytes) {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  const filename = segments.pop();
  let dir = workspaceDir;
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }

  if (!filename) {
    return;
  }

  const fileHandle = await dir.getFileHandle(filename, { create: true });

  // @ts-ignore - createWritable is available in File System Access API.
  const writable = await fileHandle.createWritable();
  // @ts-ignore - File System Access API accepts BufferSource at runtime.
  await writable.write(bytes);
  await writable.close();
}

/**
 * @param {FileSystemDirectoryHandle} workspaceDir
 * @param {string} relPath
 *
 * @returns {Promise<void>}
 */
async function deleteWorkspaceFile(workspaceDir, relPath) {
  const segments = relPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  const filename = segments.pop();
  if (!filename) {
    return;
  }

  let dir = workspaceDir;
  for (const segment of segments) {
    try {
      dir = await dir.getDirectoryHandle(segment);
    } catch (err) {
      if (isMissingFileError(err)) {
        return;
      }

      throw err;
    }
  }

  try {
    await dir.removeEntry(filename);
  } catch (err) {
    if (!isMissingFileError(err)) {
      throw err;
    }
  }
}

/**
 * @param {string} path
 *
 * @returns {string}
 */
function quoteShellPath(path) {
  return `'${path.replace(/'/g, `'"'"'`)}'`;
}

/**
 * Avoid auto-pruning transient editor/temp files that are often recreated.
 *
 * @param {string} relPath
 *
 * @returns {boolean}
 */
function shouldIgnoreWorkspaceSyncPath(relPath) {
  const leaf = relPath.split("/").pop() || relPath;

  return (
    /\.crswap$/i.test(leaf) ||
    /\.sw[pxon]$/i.test(leaf) ||
    /\.sw[pxon]\.[0-9]+$/i.test(leaf) ||
    /\.tmp$/i.test(leaf) ||
    /\.temp$/i.test(leaf) ||
    /~$/.test(leaf)
  );
}

/**
 * @param {Uint8Array} left
 * @param {Uint8Array} right
 *
 * @returns {boolean}
 */
function byteArraysEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

/**
 * @param {string} groupId
 * @param {number} now
 *
 * @returns {boolean}
 */
function canAttemptAutoDeletion(groupId, now) {
  const timestamps = groupDeletionTimestamps.get(groupId) || [];
  const active = timestamps.filter((ts) => now - ts <= VM_DELETE_WINDOW_MS);
  groupDeletionTimestamps.set(groupId, active);

  return active.length < VM_MAX_DELETES_PER_WINDOW;
}

/**
 * @param {string} groupId
 * @param {number} now
 *
 * @returns {void}
 */
function registerAutoDeletion(groupId, now) {
  const timestamps = groupDeletionTimestamps.get(groupId) || [];
  const active = timestamps.filter((ts) => now - ts <= VM_DELETE_WINDOW_MS);
  active.push(now);
  groupDeletionTimestamps.set(groupId, active);
}

/**
 * @param {TerminalAutoSyncState} state
 *
 * @returns {void}
 */
function scheduleTerminalWorkspaceFlush(state) {
  if (terminalAutoSyncState !== state || state.disposed) {
    return;
  }

  const groupId = state.context.groupId;
  const priorTimer = workspaceFlushTimers.get(groupId);
  if (priorTimer) {
    clearTimeout(priorTimer);
  }

  const timer = setTimeout(() => {
    workspaceFlushTimers.delete(groupId);

    if (workspaceFlushInFlight.has(groupId)) {
      return;
    }

    workspaceFlushInFlight.add(groupId);

    flushVMWorkspaceToHost(state.context)
      .then(() => {
        if (!state.onFlushed) {
          return;
        }

        try {
          state.onFlushed();
        } catch {
          /* ignore callback failures */
        }
      })
      .catch(() => {
        /* ignore sync failures in auto-flush path */
      })
      .finally(() => {
        workspaceFlushInFlight.delete(groupId);
      });
  }, VM_WORKSPACE_SYNC_DEBOUNCE_MS);

  workspaceFlushTimers.set(groupId, timer);
}

/**
 * @param {string} data
 *
 * @returns {void}
 */
function recordTerminalAutoSyncInput(data) {
  if (!terminalAutoSyncState || terminalAutoSyncState.disposed || !data) {
    return;
  }

  if (data.includes("\u0003")) {
    terminalAutoSyncState.commandPending = false;
    terminalAutoSyncState.recentOutput = "";
    return;
  }

  if (data.includes("\n") || data.includes("\r")) {
    // Only auto-flush commands that can plausibly touch /workspace.
    const touchesWorkspace =
      terminalAutoSyncState.cwdInWorkspace ||
      commandTextMentionsWorkspacePath(data);

    terminalAutoSyncState.commandPending = true;
    terminalAutoSyncState.commandTouchesWorkspace = touchesWorkspace;
    terminalAutoSyncState.recentOutput = "";
  }
}

/**
 * @param {string} chunk
 *
 * @returns {void}
 */
function recordTerminalAutoSyncOutput(chunk) {
  if (!terminalAutoSyncState || terminalAutoSyncState.disposed) {
    return;
  }

  terminalAutoSyncState.recentOutput += chunk;
  if (
    terminalAutoSyncState.recentOutput.length > VM_TERMINAL_PROMPT_TAIL_LENGTH
  ) {
    terminalAutoSyncState.recentOutput =
      terminalAutoSyncState.recentOutput.slice(-VM_TERMINAL_PROMPT_TAIL_LENGTH);
  }

  const promptInfo = detectShellPrompt(terminalAutoSyncState.recentOutput);
  if (promptInfo.cwd) {
    terminalAutoSyncState.cwdInWorkspace = isWorkspaceShellPath(promptInfo.cwd);
  }

  if (!terminalAutoSyncState.commandPending || !promptInfo.matches) {
    return;
  }

  const shouldFlush = terminalAutoSyncState.commandTouchesWorkspace;

  terminalAutoSyncState.commandPending = false;
  terminalAutoSyncState.commandTouchesWorkspace = false;
  terminalAutoSyncState.recentOutput = "";

  if (!shouldFlush) {
    return;
  }

  terminalAutoSyncState.flushSoon();
}

/**
 * @param {string} text
 *
 * @returns {{ matches: boolean, cwd: string|null }}
 */
function detectShellPrompt(text) {
  const promptMatches = text.matchAll(
    /(?:^|[\r\n])[^\r\n]*:([^\r\n#\$]+)[#$](?:\s|$)/g,
  );

  /** @type {string|null} */
  let cwd = null;

  for (const match of promptMatches) {
    if (typeof match[1] === "string") {
      cwd = match[1].trim();
    }
  }

  return {
    matches: /(?:^|[\r\n])[^\r\n]*[#$](?:\s|$)/.test(text),
    cwd,
  };
}

/**
 * @param {string} data
 *
 * @returns {boolean}
 */
function commandTextMentionsWorkspacePath(data) {
  return /(?:^|\s|['"`])\/workspace(?:\/|\s|$|['"`])/.test(data);
}

/**
 * @param {string} path
 *
 * @returns {boolean}
 */
function isWorkspaceShellPath(path) {
  return path === "/workspace" || path.startsWith("/workspace/");
}

/**
 * @param {string} groupId
 * @param {string} relPath
 *
 * @returns {void}
 */
function protectHostSeededFileFromPrune(groupId, relPath) {
  const key = `${groupId}:${relPath}`;
  hostSeededFilePruneProtection.set(
    key,
    Date.now() + VM_HOST_SEEDED_FILE_PRUNE_GRACE_MS,
  );
}

/**
 * @param {string} groupId
 * @param {string} relPath
 *
 * @returns {void}
 */
function clearHostSeededFilePruneProtection(groupId, relPath) {
  const key = `${groupId}:${relPath}`;
  hostSeededFilePruneProtection.delete(key);
}

/**
 * @param {string} groupId
 * @param {string} relPath
 *
 * @returns {boolean}
 */
function isHostSeededFilePruneProtected(groupId, relPath) {
  const key = `${groupId}:${relPath}`;
  const expiresAt = hostSeededFilePruneProtection.get(key);
  if (!expiresAt) {
    return false;
  }

  if (expiresAt <= Date.now()) {
    hostSeededFilePruneProtection.delete(key);
    return false;
  }

  return true;
}

/**
 * Notify listeners of VM status changes.
 *
 * @returns {void}
 */
function emitVMStatus() {
  const status = getVMStatus();

  statusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (_) {
      /* ignore listener failures */
    }
  });
}

/**
 * @param {any} emulator
 *
 * @returns {void}
 */
function attachActiveTerminalOutputListener(emulator) {
  if (
    terminalOutputAttached ||
    !terminalOutputListener ||
    !emulator?.add_listener
  ) {
    return;
  }

  emulator.add_listener("serial0-output-byte", terminalOutputListener);
  terminalOutputAttached = true;
}

/**
 * @param {any} emulator
 *
 * @returns {void}
 */
function detachActiveTerminalOutputListener(emulator) {
  if (
    !terminalOutputAttached ||
    !terminalOutputListener ||
    !emulator?.remove_listener
  ) {
    return;
  }

  emulator.remove_listener("serial0-output-byte", terminalOutputListener);
  terminalOutputAttached = false;
}

/**
 * Wait for serial output to contain needle
 *
 * @param {any} emulator
 * @param {string} needle
 * @param {number} timeoutMs
 *
 * @returns {Promise<void>}
 */
function waitForSerial(emulator, needle, timeoutMs) {
  return new Promise((resolve, reject) => {
    let buffer = "";

    const timer = setTimeout(() => {
      if (emulator.remove_listener) {
        emulator.remove_listener("serial0-output-byte", listener);
      }

      reject(new Error(`Timeout waiting for "${needle}"`));
    }, timeoutMs);

    /** @param {number} byte */
    const listener = (byte) => {
      buffer += String.fromCharCode(byte);

      if (buffer.includes(needle)) {
        clearTimeout(timer);

        if (emulator.remove_listener) {
          emulator.remove_listener("serial0-output-byte", listener);
        }

        resolve();
      }
    };

    if (emulator.add_listener) {
      emulator.add_listener("serial0-output-byte", listener);
    }
  });
}

/**
 * Execute a command in the emulator
 *
 * @param {any} emulator
 * @param {string} command
 * @param {number} timeoutSec
 *
 * @returns {Promise<VMResult>}
 */
function executeCommand(emulator, command, timeoutSec) {
  return new Promise((resolve) => {
    const marker = `__BCDONE_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}__`;
    const markerPattern = new RegExp(
      `(?:^|\\n)${escapeRegExp(marker)}([0-9]+)(?:\\r?\\n|$)`,
    );

    let output = "";
    let settled = false;

    /**
     * @param {VMResult} result
     *
     * @returns {void}
     */
    const settle = (result) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const timer = setTimeout(async () => {
      if (emulator.remove_listener) {
        emulator.remove_listener("serial0-output-byte", listener);
      }

      await interruptAndRecoverPrompt(emulator, VM_TIMEOUT_RECOVERY_MS);

      settle({ stdout: output, stderr: "", exitCode: 1, timedOut: true });
    }, timeoutSec * 1000);

    /** @param {number} byte */
    const listener = (byte) => {
      const ch = String.fromCharCode(byte);
      output += ch;

      const match = markerPattern.exec(output);
      if (match) {
        clearTimeout(timer);

        if (emulator.remove_listener) {
          emulator.remove_listener("serial0-output-byte", listener);
        }

        const markerIndex = typeof match.index === "number" ? match.index : -1;
        const stdout = markerIndex >= 0 ? output.slice(0, markerIndex) : output;
        const exitCode = parseInt(match[1] || "0", 10);

        settle({
          stdout,
          stderr: "",
          exitCode,
          timedOut: false,
        });
      }
    };

    // Send command
    if (emulator.add_listener) {
      emulator.add_listener("serial0-output-byte", listener);
    }

    emulator.serial0_send(
      `${command} 2>&1; __BCDONE_EXIT=$?; printf "\\n${marker}%s\\n" "$__BCDONE_EXIT"\n`,
    );
  });
}

/**
 * @param {string} text
 *
 * @returns {string}
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Run an internal VM command without leaking command echo/markers into the
 * interactive terminal stream.
 *
 * @param {any} emulator
 * @param {string} command
 * @param {number} timeoutSec
 *
 * @returns {Promise<VMResult>}
 */
async function runInternalVMCommand(emulator, command, timeoutSec) {
  const shouldSuspendTerminal = activeUsage === "terminal";
  const wasSuspended = terminalSuspended;

  if (shouldSuspendTerminal) {
    terminalSuspended = true;
  }

  try {
    const result = await executeCommand(emulator, command, timeoutSec);

    // Keep terminal suspended briefly to swallow trailing prompt redraw bytes
    // emitted immediately after internal command completion.
    if (shouldSuspendTerminal) {
      await waitForSerialQuiet(emulator, 30, 250);
    }

    return result;
  } finally {
    if (shouldSuspendTerminal) {
      terminalSuspended = wasSuspended;
    }
  }
}

/**
 * Wait until serial output has been quiet for `quietMs`, or stop after `maxMs`.
 * Used to avoid leaking shell prompt redraw bytes after internal commands.
 *
 * @param {any} emulator
 * @param {number} quietMs
 * @param {number} maxMs
 *
 * @returns {Promise<void>}
 */
function waitForSerialQuiet(emulator, quietMs, maxMs) {
  if (!emulator?.add_listener || !emulator?.remove_listener) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    /** @type {ReturnType<typeof setTimeout>|null} */
    let quietTimer = null;

    const settle = () => {
      if (settled) {
        return;
      }

      settled = true;
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }

      clearTimeout(maxTimer);
      emulator.remove_listener("serial0-output-byte", listener);
      resolve();
    };

    /** @param {number} _byte */
    const listener = (_byte) => {
      if (quietTimer) {
        clearTimeout(quietTimer);
      }

      quietTimer = setTimeout(() => {
        settle();
      }, quietMs);
    };

    const maxTimer = setTimeout(() => {
      settle();
    }, maxMs);

    emulator.add_listener("serial0-output-byte", listener);
    quietTimer = setTimeout(() => {
      settle();
    }, quietMs);
  });
}

/**
 * Try to interrupt a timed-out command and recover the shell prompt.
 *
 * @param {any} emulator
 * @param {number} timeoutMs
 *
 * @returns {Promise<void>}
 */
async function interruptAndRecoverPrompt(emulator, timeoutMs) {
  try {
    emulator.serial0_send("\u0003");
    emulator.serial0_send("\n");

    await waitForSerial(emulator, VM_SHELL_PROMPT_NEEDLE, timeoutMs);
  } catch {
    // Best-effort recovery only; next command may still succeed once shell returns.
  }
}
