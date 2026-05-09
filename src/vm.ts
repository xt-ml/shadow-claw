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

import {
  BASH_DEFAULT_TIMEOUT_SEC,
  DEFAULT_VM_NETWORK_RELAY_URL,
} from "./config.js";
import { ShadowClawDatabase } from "./db/db.js";
import { getGroupDir } from "./storage/getGroupDir.js";
import { getStorageRoot, getStorageStatus } from "./storage/storage.js";

export interface V86BootConfig {
  mode: VMBootMode;
  label: string;
  libUrl: string;
  wasmUrl: string;
  biosUrl: string;
  vgaBiosUrl: string;
  ext2Url?: string;
  bzImageUrl?: string;
  initrdUrl?: string;
  basefsUrl?: string; // Only for 9p
  baseurl?: string; // Only for 9p
}

export interface VMResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export interface VMInstance {
  isReady: () => boolean;
  execute: (command: string, timeoutSec: number) => Promise<VMResult>;
  getEmulator: () => any;
  getMode: () => "ext2" | "9p";
  destroy: () => void | Promise<void>;
}

export interface VMExecuteContext {
  db: ShadowClawDatabase;
  groupId: string;
}

export type VMBootMode = "disabled" | "auto" | "9p" | "ext2";

export interface VMStatus {
  ready: boolean;
  booting: boolean;
  bootAttempted: boolean;
  error: string | null;
  mode?: "ext2" | "9p" | null;
}

export interface VMTerminalSession {
  close: () => void;
  send: (data: string) => void;
}

export interface TerminalAutoSyncState {
  context: VMExecuteContext;
  onFlushed: (() => void) | null;
  recentOutput: string;
  commandPending: boolean;
  commandTouchesWorkspace: boolean;
  cwdInWorkspace: boolean;
  disposed: boolean;
  flushSoon: () => void;
}

const bootOutputListeners: Set<(chunk: string) => void> = new Set();
const statusListeners = new Set<(status: VMStatus) => void>();
const WEBVM_DISABLED_MESSAGE =
  "WebVM is disabled. Enable it in Settings to use WebVM.";

const VM_DELETE_WINDOW_MS = 60_000;
const VM_HOST_SEEDED_FILE_PRUNE_GRACE_MS = 15_000;
const VM_MAX_BOOT_TRANSCRIPT_LENGTH = 160_000;
const VM_MAX_DELETES_PER_WINDOW = 25;
const VM_MISSING_FILE_DELETE_COOLDOWN_MS = 10_000;
const VM_MISSING_FILE_REQUIRED_PASSES = 3;
const VM_RUNTIME = typeof document === "undefined" ? "worker" : "ui";
const VM_SHELL_PROMPT_NEEDLE = "# ";
const VM_TERMINAL_PROMPT_TAIL_LENGTH = 512;
const VM_TIMEOUT_RECOVERY_MS = 5_000;
const VM_WORKSPACE_SYNC_DEBOUNCE_MS = 200;

const groupDeletionTimestamps: Map<string, number[]> = new Map();
const hostSeededFilePruneProtection: Map<string, number> = new Map();
const missingFileDeleteRetryAt: Map<string, number> = new Map();
const missingFileSeenCount: Map<string, number> = new Map();
const vmObservedWorkspaceFilesByGroup: Map<string, Set<string>> = new Map();
const workspaceFlushInFlight: Set<string> = new Set();
const workspaceFlushTimers: Map<
  string,
  ReturnType<typeof setTimeout>
> = new Map();

let activeEmulator: any = null; // Track emulator for cleanup on failure
let activeMode: "ext2" | "9p" | null = null;
let activeUsage: "command" | "terminal" | null = null;
let bootAttempted = false;
let bootGeneration = 0;
let booting = false;
let bootPromise: Promise<void> | null = null;
let instance: VMInstance | null = null;
let lastBootError: string | null = null;
let liveBootTranscript: string = "";
let pendingBootTranscript: string = "";
let preferredBootHost: string | null = null;
let preferredBootMode: VMBootMode = "disabled";
let preferredNetworkRelayURL: string = DEFAULT_VM_NETWORK_RELAY_URL;
let suppressBootTranscriptReplay: boolean = false;
let terminalAutoSyncState: TerminalAutoSyncState | null = null;
let terminalOutputAttached: boolean = false;
let terminalOutputListener: ((byte: number) => void) | null = null;
let terminalSuspended: boolean = false;

function isCurrentBoot(bootToken: number): boolean {
  return bootToken === bootGeneration;
}

function getVMLogPrefix(): string {
  return `[WebVM:${VM_RUNTIME}]`;
}

/**
 * Destroy a v86 emulator instance while swallowing both sync throws and
 * async rejection paths from some v86 builds.
 */
async function destroyEmulatorSafely(emulator: any): Promise<void> {
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
 */
export async function bootVM(): Promise<void> {
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
 */
export async function executeInVM(
  command: string,
  timeoutSec: number = BASH_DEFAULT_TIMEOUT_SEC,
  context: VMExecuteContext | null = null,
): Promise<string> {
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

    // In 9p mode, prefix user commands with `cd /home/user` so they execute
    // in the workspace directory (matching just-bash's /home/user prefix).
    const wrappedCommand =
      instance.getMode() === "9p" ? `cd /home/user && ${command}` : command;
    const result = await instance.execute(wrappedCommand, timeoutSec);

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

export function __setVMInstanceForTests(nextInstance: VMInstance | null) {
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

export async function shutdownVM(): Promise<void> {
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
 */
export function isVMReady(): boolean {
  return instance?.isReady() ?? false;
}

export function getVMStatus(): VMStatus {
  return {
    ready: instance?.isReady() ?? false,
    booting,
    bootAttempted,
    mode: activeMode,
    error:
      preferredBootMode === "disabled" ? WEBVM_DISABLED_MESSAGE : lastBootError,
  };
}

export function setVMBootModePreference(mode: VMBootMode) {
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

export function getVMBootModePreference(): VMBootMode {
  return preferredBootMode;
}

/**
 * Set preferred boot host for VM asset lookup.
 * Pass null/empty to use deployment-derived defaults.
 */
export function setVMBootHostPreference(bootHost: string | null | undefined) {
  preferredBootHost = normalizeBootHost(bootHost);
}

export function getVMBootHostPreference(): string | null {
  return preferredBootHost;
}

/**
 * Set preferred network relay URL used by the VM NIC.
 * Pass null/empty to use default.
 */
export function setVMNetworkRelayURLPreference(
  relayUrl: string | null | undefined,
): void {
  preferredNetworkRelayURL =
    normalizeRelayURL(relayUrl) || DEFAULT_VM_NETWORK_RELAY_URL;
}

export function getVMNetworkRelayURLPreference(): string {
  return preferredNetworkRelayURL;
}

function normalizeBootHost(bootHost: string | null | undefined): string | null {
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

function getDefaultBootHost(): string {
  return new URL("..", import.meta.url).href.replace(/\/+$/, "");
}

function normalizeRelayURL(relayUrl: string | null | undefined): string | null {
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
 */
export function subscribeVMStatus(listener: (status: VMStatus) => void) {
  statusListeners.add(listener);
  listener(getVMStatus());

  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * Create a serial terminal session connected to the running VM.
 */
export function createTerminalSession(onOutput: (chunk: string) => void) {
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
 */
export function subscribeVMBootOutput(onOutput: (chunk: string) => void) {
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
 */
export function __setBootTranscriptForTests(
  transcript: string,
  suppressReplay = false,
) {
  pendingBootTranscript = typeof transcript === "string" ? transcript : "";
  liveBootTranscript = "";
  suppressBootTranscriptReplay = !!suppressReplay;
}

/**
 * Ensure /home/user in the running 9p VM reflects host storage contents.
 */
export async function syncVMWorkspaceFromHost(context: VMExecuteContext) {
  if (!instance?.isReady() || instance.getMode() !== "9p") {
    return;
  }

  await syncHostWorkspaceToVM(instance.getEmulator(), context);
}

/**
 * Attach a debounced 9p write listener for an active terminal session.
 */
export function attachTerminalWorkspaceAutoSync(
  context: VMExecuteContext,
  onFlushed: (() => void) | null = null,
): (() => void) | null {
  if (!instance?.isReady() || instance.getMode() !== "9p") {
    return null;
  }

  const emulator = instance.getEmulator();

  if (!emulator?.add_listener || !emulator?.remove_listener) {
    return null;
  }

  const groupId = context.groupId;
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
 * Sync /home/user files from the VM into host storage.
 *
 * Call this after interactive terminal sessions to surface any files the user
 * created or modified directly in the VM shell.
 */
export async function flushVMWorkspaceToHost(
  context: VMExecuteContext,
): Promise<void> {
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
 * Boot the VM (internal implementation)
 */
async function doBootVM(bootToken: number): Promise<void> {
  let emulator: any = null;

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

    if (bootConfig.mode === "ext2" || bootConfig.mode === "9p") {
      activeMode = bootConfig.mode;
    }

    console.log(
      `${getVMLogPrefix()} Using ${bootConfig.mode} boot mode (${bootConfig.label}). Loading v86 module...`,
    );

    // Dynamically import v86
    let V86;
    try {
      // Use local v86 module from assets
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
    let bootLog = "";
    liveBootTranscript = "";

    const bootLogger = (byte: number) => {
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

        if (line) {
          console.log(`${getVMLogPrefix()} [boot]`, line);
        }

        bootLog = "";
      }
    };

    if (emulator && emulator.add_listener) {
      emulator.add_listener("serial0-output-byte", bootLogger);
    }

    // Wait for shell prompt — 9p boot from chunks is slow, allow 600s
    await waitForSerial(emulator!, "login:", 600_000);
    if (!isCurrentBoot(bootToken)) {
      await destroyEmulatorSafely(emulator!);

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    console.log(`${getVMLogPrefix()} Got login prompt...`);

    emulator!.serial0_send("root\n");

    await waitForSerial(emulator!, "# ", 60000);
    if (!isCurrentBoot(bootToken)) {
      await destroyEmulatorSafely(emulator!);

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    // Remove boot logger after reaching interactive root shell prompt.
    if (emulator && emulator.remove_listener) {
      emulator.remove_listener("serial0-output-byte", bootLogger);
    }

    if (liveBootTranscript) {
      pendingBootTranscript = liveBootTranscript;
    }

    if (bootConfig.mode === "9p") {
      await executeCommand(emulator!, "mkdir -p /home/user", 20);
      // Set HOME and default cwd persistently so both interactive terminal
      // sessions and tool commands land in /home/user.
      await executeCommand(
        emulator!,
        'echo "export HOME=/home/user" >> /etc/profile && echo "cd /home/user" >> /etc/profile',
        20,
      );
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
      getMode: () => bootConfig.mode as "ext2" | "9p",
      destroy: async () => {
        instance = null;
        if (activeEmulator === emulator) {
          activeEmulator = null;
        }

        await destroyEmulatorSafely(emulator);
      },
      execute: (cmd, timeout) => executeCommand(emulator, cmd, timeout),
    };

    // Keep reference for cleanup
    activeEmulator = emulator;

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

async function resolveBootConfig(): Promise<V86BootConfig | null> {
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

  const ext2Config: V86BootConfig = {
    mode: "ext2",
    label: "ext2/hda",
    libUrl: `${ext2Root}/libv86.mjs`,
    wasmUrl: `${ext2Root}/v86.wasm`,
    biosUrl: `${ext2Root}/seabios.bin`,
    vgaBiosUrl: `${ext2Root}/vgabios.bin`,
    ext2Url: `${ext2Root}/alpine-rootfs.ext2`,
    bzImageUrl: `${ext2Root}/bzImage`,
    initrdUrl: `${ext2Root}/initrd`,
  };

  const ninePConfig: V86BootConfig = {
    mode: "9p",
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

  if (ninePOk) {
    console.log(
      "[WebVM boot] Mode 3: 9p with flat manifest found - preferred auto fallback",
    );

    return ninePConfig;
  }

  if (ext2Ok) {
    console.log(
      "[WebVM boot] Mode 4: ext2 with all assets - fallback boot path",
    );

    return ext2Config;
  }

  console.log(
    "[WebVM boot] Mode 5: no bootable 9p or ext2 assets found, skipping boot",
  );

  return null;
}

/**
 * Test-only helper for boot config selection logic.
 */
export function __resolveBootConfigForTests(): ReturnType<
  typeof resolveBootConfig
> {
  return resolveBootConfig();
}

async function assetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });

    return !!res.ok;
  } catch {
    return false;
  }
}

async function assetsExist(urls: string[]): Promise<boolean> {
  const checks = await Promise.all(urls.map((url) => assetExists(url)));

  return checks.every(Boolean);
}

async function syncHostWorkspaceToVM(emulator: any, context: VMExecuteContext) {
  const { db, groupId } = context;

  // Diagnostic: check what storage root the worker is using
  const storageRoot = await getStorageRoot(db);
  const storageStatus = await getStorageStatus(db);
  console.log(
    `${getVMLogPrefix()} syncHostWorkspaceToVM: storage root name="${storageRoot?.name}", ` +
      `type=${storageStatus.type}, permission=${storageStatus.permission}`,
  );

  const workspaceDir = await getGroupDir(db, groupId);
  const fs9p = emulator?.fs9p;

  // Diagnostic: enumerate what's actually in the workspace dir
  const debugEntries: string[] = [];
  try {
    for await (const [name, handle] of (workspaceDir as any).entries()) {
      debugEntries.push(`${name}(${handle.kind})`);
    }
  } catch (e) {
    debugEntries.push(`[error: ${e}]`);
  }

  console.log(
    `${getVMLogPrefix()} syncHostWorkspaceToVM: groupId=${groupId}, ` +
      `workspaceDir.name=${workspaceDir?.name}, fs9p=${!!fs9p}, ` +
      `entries=[${debugEntries.join(", ")}]`,
  );

  // Ensure the mountpoint exists even if a previous boot did not finish setup.
  if (!vmPathExists(fs9p, "/home/user")) {
    await runInternalVMCommand(emulator, "mkdir -p /home/user", 20).catch(
      (err) => {
        console.warn("[WebVM] Failed to create /home/user in VM:", err);
      },
    );
  }

  const hostFiles: string[] = [];
  await collectWorkspaceFiles(workspaceDir, "", hostFiles);
  recordObservedVMWorkspaceFiles(groupId, hostFiles);

  const hostFileSet = new Set(hostFiles);

  const ensuredDirs = new Set();

  if (fs9p?.read_dir) {
    const vmFiles: string[] = [];
    try {
      collectVMFiles(fs9p, "/home/user", "", vmFiles);
      recordObservedVMWorkspaceFiles(groupId, vmFiles);
    } catch {
      // If /home/user cannot be enumerated yet, skip pruning for this pass.
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
        `rm -f ${quoteShellPath(`/home/user/${relPath}`)}`,
        20,
      ).catch((err) => {
        console.warn("[WebVM] Failed to delete file in VM:", err);
      });

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
        `mkdir -p ${quoteShellPath(`/home/user/${dirPath}`)}`,
        20,
      ).catch((err) => {
        console.warn("[WebVM] Failed to create directory in VM:", err);
      });
    }

    let bytes: Uint8Array | null = null;
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

    const vmPath = `/home/user/${relPath}`;
    const existingBytes = await readVMFileBytes(emulator, vmPath);
    if (existingBytes && byteArraysEqual(existingBytes, bytes)) {
      continue;
    }

    protectHostSeededFileFromPrune(groupId, relPath);

    // create_file writes directly into fs9p without serial/base64 overhead.
    await emulator.create_file(vmPath, bytes);
  }
}

function isMissingFileError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }

  const candidate: any = err;
  const name = typeof candidate.name === "string" ? candidate.name : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";

  return name === "NotFoundError" || /file\s+not\s+found/i.test(message);
}

async function syncVMWorkspaceToHost(emulator: any, context: VMExecuteContext) {
  const fs9p = emulator?.fs9p;
  if (!fs9p?.read_dir) {
    return;
  }

  const workspaceDir = await getGroupDir(context.db, context.groupId);

  const vmFiles = [];
  collectVMFiles(fs9p, "/home/user", "", vmFiles);
  recordObservedVMWorkspaceFiles(context.groupId, vmFiles);

  const vmFileSet = new Set(vmFiles);

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

    const wasObserved = wasWorkspaceFileObservedInVM(context.groupId, relPath);
    if (!wasObserved) {
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

    const data = await emulator.read_file(`/home/user/${relPath}`);
    if (!data) {
      continue;
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

    let currentBytes: Uint8Array | null = null;
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

function recordObservedVMWorkspaceFiles(groupId: string, relPaths: string[]) {
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

function wasWorkspaceFileObservedInVM(
  groupId: string,
  relPath: string,
): boolean {
  if (!groupId || !relPath) {
    return false;
  }

  const observed = vmObservedWorkspaceFilesByGroup.get(groupId);

  return observed ? observed.has(relPath) : false;
}

async function collectWorkspaceFiles(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  out: string[],
): Promise<void> {
  for await (const [name, handle] of (dir as any).entries()) {
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

function vmPathExists(fs9p: any, vmPath: string): boolean {
  if (!fs9p?.SearchPath) {
    return false;
  }

  const result = fs9p.SearchPath(vmPath);

  return !!result && result.id !== -1;
}

function collectVMFiles(
  fs9p: any,
  vmDir: string,
  prefix: string,
  out: string[],
): void {
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

async function readWorkspaceFileBytes(
  workspaceDir: FileSystemDirectoryHandle,
  relPath: string,
): Promise<Uint8Array | null> {
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

async function readVMFileBytes(
  emulator: any,
  vmPath: string,
): Promise<Uint8Array | null> {
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

async function writeWorkspaceFileBytes(
  workspaceDir: FileSystemDirectoryHandle,
  relPath: string,
  bytes: Uint8Array,
): Promise<void> {
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
  const writable: any = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

async function deleteWorkspaceFile(
  workspaceDir: FileSystemDirectoryHandle,
  relPath: string,
): Promise<void> {
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

function quoteShellPath(path: string): string {
  return `'${path.replace(/'/g, `'"'"'`)}'`;
}

function shouldIgnoreWorkspaceSyncPath(relPath: string): boolean {
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

function byteArraysEqual(left: Uint8Array, right: Uint8Array): boolean {
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

function canAttemptAutoDeletion(groupId: string, now: number): boolean {
  const timestamps = groupDeletionTimestamps.get(groupId) || [];
  const active = timestamps.filter((ts) => now - ts <= VM_DELETE_WINDOW_MS);
  groupDeletionTimestamps.set(groupId, active);

  return active.length < VM_MAX_DELETES_PER_WINDOW;
}

function registerAutoDeletion(groupId: string, now: number): void {
  const timestamps = groupDeletionTimestamps.get(groupId) || [];
  const active = timestamps.filter((ts) => now - ts <= VM_DELETE_WINDOW_MS);
  active.push(now);
  groupDeletionTimestamps.set(groupId, active);
}

function scheduleTerminalWorkspaceFlush(state: TerminalAutoSyncState): void {
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

function recordTerminalAutoSyncInput(data: string): void {
  if (!terminalAutoSyncState || terminalAutoSyncState.disposed || !data) {
    return;
  }

  if (data.includes("\u0003")) {
    terminalAutoSyncState.commandPending = false;
    terminalAutoSyncState.recentOutput = "";

    return;
  }

  if (data.includes("\n") || data.includes("\r")) {
    // Only auto-flush commands that can plausibly touch /home/user.
    const touchesWorkspace =
      terminalAutoSyncState.cwdInWorkspace || isWorkspaceMutation(data);

    terminalAutoSyncState.commandPending = true;
    terminalAutoSyncState.commandTouchesWorkspace = touchesWorkspace;
    terminalAutoSyncState.recentOutput = "";
  }
}

function recordTerminalAutoSyncOutput(chunk: string): void {
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

function detectShellPrompt(text: string): {
  matches: boolean;
  cwd: string | null;
} {
  const promptMatches = text.matchAll(
    /(?:^|[\r\n])[^\r\n]*:([^\r\n#\$]+)[#$](?:\s|$)/g,
  );

  let cwd: string | null = null;

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

function isWorkspaceMutation(data: string): boolean {
  return /(?:^|\s|['"`])\/home\/user(?:\/|\s|$|['"`])/.test(data);
}

function isWorkspaceShellPath(path: string): boolean {
  return path === "/home/user" || path.startsWith("/home/user/");
}

function protectHostSeededFileFromPrune(
  groupId: string,
  relPath: string,
): void {
  const key = `${groupId}:${relPath}`;
  hostSeededFilePruneProtection.set(
    key,
    Date.now() + VM_HOST_SEEDED_FILE_PRUNE_GRACE_MS,
  );
}

function clearHostSeededFilePruneProtection(groupId: string, relPath: string) {
  const key = `${groupId}:${relPath}`;
  hostSeededFilePruneProtection.delete(key);
}

function isHostSeededFilePruneProtected(
  groupId: string,
  relPath: string,
): boolean {
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

function attachActiveTerminalOutputListener(emulator: any): void {
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

function detachActiveTerminalOutputListener(emulator: any): void {
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
 */
function waitForSerial(
  emulator: any,
  needle: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let buffer = "";

    const timer = setTimeout(() => {
      if (emulator.remove_listener) {
        emulator.remove_listener("serial0-output-byte", listener);
      }

      reject(new Error(`Timeout waiting for "${needle}"`));
    }, timeoutMs);

    const listener = (byte: number) => {
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
 */
function executeCommand(
  emulator: any,
  command: string,
  timeoutSec: number,
): Promise<VMResult> {
  return new Promise<VMResult>((resolve) => {
    const marker = `__BCDONE_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}__`;
    const markerPattern = new RegExp(
      `(?:^|\\n)${escapeRegExp(marker)}([0-9]+)(?:\\r?\\n|$)`,
    );

    let output = "";
    let settled = false;

    const settle = (result: VMResult) => {
      if (settled) {
        return;
      }

      settled = true;
      let cleanOutput = output.replace(markerPattern, "");

      // The TTY echoes the command we entered.
      // Because it may wrap based on terminal columns, we reliably locate the end of our command
      // by finding the exit variable that we echoed as the final token.
      const echoEndMarker = '"$__BCDONE_EXIT"';
      const echoEndIdx = cleanOutput.indexOf(echoEndMarker);
      if (echoEndIdx !== -1) {
        // Slice up to the end of the line containing the echo marker
        const nextNewlineIdx = cleanOutput.indexOf("\n", echoEndIdx);
        if (nextNewlineIdx !== -1) {
          cleanOutput = cleanOutput.slice(nextNewlineIdx + 1);
        } else {
          cleanOutput = cleanOutput.slice(echoEndIdx + echoEndMarker.length);
        }
      }

      // Strip ANSI escape codes
      cleanOutput = cleanOutput.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

      // Remove trailing whitespace/newlines from the actual command output
      cleanOutput = cleanOutput.trimEnd();
      resolve({ ...result, stdout: cleanOutput });
    };

    const timer = setTimeout(async () => {
      if (emulator.remove_listener) {
        emulator.remove_listener("serial0-output-byte", listener);
      }

      await interruptAndRecoverPrompt(emulator, VM_TIMEOUT_RECOVERY_MS);

      settle({ stdout: output, stderr: "", exitCode: 1, timedOut: true });
    }, timeoutSec * 1000);

    const listener = (byte: number) => {
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

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Run an internal VM command without leaking command echo/markers into the
 * interactive terminal stream.
 *
 */
async function runInternalVMCommand(
  emulator: any,
  command: string,
  timeoutSec: number,
): Promise<VMResult> {
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
 */
function waitForSerialQuiet(
  emulator: any,
  quietMs: number,
  maxMs: number,
): Promise<void> {
  if (!emulator?.add_listener || !emulator?.remove_listener) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    let quietTimer: ReturnType<typeof setTimeout> | null = null;

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

    const listener = (_byte: number) => {
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
 */
async function interruptAndRecoverPrompt(
  emulator: any,
  timeoutMs: number,
): Promise<void> {
  try {
    emulator.serial0_send("\u0003");
    emulator.serial0_send("\n");

    await waitForSerial(emulator, VM_SHELL_PROMPT_NEEDLE, timeoutMs);
  } catch {
    // Best-effort recovery only; next command may still succeed once shell returns.
  }
}
