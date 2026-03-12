/**
 * ShadowClaw — WebVM wrapper (v86-based Alpine Linux in WebAssembly)
 *
 * This module manages a lightweight Linux VM running inside a Web Worker.
 * The VM is booted eagerly when the worker starts and cached for reuse.
 * Commands fall back to the JS shell emulator while the VM is still booting.
 *
 * Implementation notes:
 * - Can use v86 (https://github.com/copy/v86.git) or compatible WASM emulator
 */

import { getWorkspaceDir } from "./storage/getWorkspaceDir.mjs";

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
 * @property {() => void} destroy
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
 */

/**
 * @typedef {Object} VMTerminalSession
 *
 * @property {() => void} close
 * @property {(data: string) => void} send
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
let active9pManifest = null;

/** @type {Set<string>} */
const seededWorkspaceGroups = new Set();

/** @type {Set<(status: VMStatus) => void>} */
const statusListeners = new Set();

/** @type {'command'|'terminal'|null} */
let activeUsage = null;

const VM_RUNTIME = typeof document === "undefined" ? "worker" : "ui";
const WEBVM_DISABLED_MESSAGE =
  "WebVM is disabled. Enable it in Settings to use WebVM.";

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
 * Does NOT block on boot — if the VM isn't ready, returns an error immediately
 * so the caller can fall back to the JS shell emulator.
 *
 * @param {string} command
 * @param {number} [timeoutSec=30]
 * @param {VMExecuteContext|null} [context=null]
 *
 * @returns {Promise<string>}
 */
export async function executeInVM(command, timeoutSec = 30, context = null) {
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

  if (activeUsage === "terminal") {
    return "Error: WebVM is currently attached to the interactive terminal. Close the terminal session before running bash commands.";
  }

  activeUsage = "command";

  try {
    if (instance.getMode() === "9p" && context && context.groupId) {
      try {
        await syncHostWorkspaceToVM(instance.getEmulator(), context);
      } catch (err) {
        console.warn("[WebVM] Failed to seed host workspace into 9p VM:", err);
      }
    }

    const result = await instance.execute(command, timeoutSec);

    if (instance.getMode() === "9p" && context && context.groupId) {
      try {
        await syncVMWorkspaceToHost(instance.getEmulator(), context);
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
    if (activeUsage === "command") {
      activeUsage = null;
    }
  }
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
  instance?.destroy();
  instance = null;
  bootPromise = null;
  lastBootError = null;
  activeMode = null;
  active9pManifest = null;
  seededWorkspaceGroups.clear();

  if (activeEmulator) {
    try {
      activeEmulator.destroy();
    } catch (_) {
      /* ignore */
    }

    activeEmulator = null;
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
    onOutput(String.fromCharCode(byte));
  };

  activeUsage = "terminal";
  emulator.add_listener("serial0-output-byte", listener);

  return {
    close() {
      emulator.remove_listener("serial0-output-byte", listener);
      if (activeUsage === "terminal") {
        activeUsage = null;
      }
    },
    send(data) {
      emulator.serial0_send(data);
    },
  };
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
    console.log(`${getVMLogPrefix()} Starting boot - checking assets...`);

    const bootConfig = await resolveBootConfig();
    if (!isCurrentBoot(bootToken)) {
      return;
    }

    if (!bootConfig) {
      const msg =
        "Assets not found. Checked 9p flat manifest assets at /assets/v86.9pfs/ and ext2 assets at /assets/v86.ext2/.";

      console.warn(
        `${getVMLogPrefix()} ${msg} The bash tool will fall back to the JS shell emulator.`,
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
      vga_memory_size: 0,
      bios: { url: bootConfig.biosUrl },
      vga_bios: { url: bootConfig.vgaBiosUrl },
      ...(bootConfig.mode === "ext2"
        ? {
            bzimage: { url: bootConfig.bzImageUrl },
            initrd: { url: bootConfig.initrdUrl },
            hda: { url: bootConfig.ext2Url, async: true },
            cmdline:
              "rw root=/dev/sda rootfstype=ext2 tsc=reliable console=ttyS0 fsck.mode=skip rootdelay=1",
          }
        : {
            filesystem: {
              basefs: bootConfig.basefsUrl,
              ...(bootConfig.baseurl ? { baseurl: bootConfig.baseurl } : {}),
            },
            // 9p virtio root (host9p) per v86 docs.
            cmdline:
              "rw root=host9p rootfstype=9p rootflags=trans=virtio,version=9p2000.L tsc=reliable console=ttyS0 fsck.mode=skip rootdelay=1",
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
      try {
        emulator.destroy();
      } catch (_) {
        /* ignore */
      }

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

    /** @param {number} byte */
    const bootLogger = (byte) => {
      const ch = String.fromCharCode(byte);

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
      try {
        emulator.destroy();
      } catch (_) {
        /* ignore */
      }

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    // Remove boot logger
    if (emulator.remove_listener) {
      emulator.remove_listener("serial0-output-byte", bootLogger);
    }

    console.log(`${getVMLogPrefix()} Got login prompt...`);

    emulator.serial0_send("root\n");

    await waitForSerial(emulator, "# ", 60000);
    if (!isCurrentBoot(bootToken)) {
      try {
        emulator.destroy();
      } catch (_) {
        /* ignore */
      }

      if (activeEmulator === emulator) {
        activeEmulator = null;
      }

      return;
    }

    if (bootConfig.mode === "9p") {
      await executeCommand(emulator, "mkdir -p /workspace", 20);
      if (!isCurrentBoot(bootToken)) {
        try {
          emulator.destroy();
        } catch (_) {
          /* ignore */
        }

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
      destroy: () => {
        try {
          emulator?.destroy();
        } catch (_) {
          /* ignore */
        }
        instance = null;
        activeEmulator = null;
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
        try {
          emulator.destroy();
        } catch (_) {
          /* ignore */
        }
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

      try {
        emulator.destroy();
      } catch (_) {
        /* ignore */
      }

      activeEmulator = null;
    }

    console.warn(
      `${getVMLogPrefix()} The bash tool will fall back to the JS shell emulator.`,
    );

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
  const ext2Root = "/assets/v86.ext2";
  const ninePRoot = "/assets/v86.9pfs";

  const shared9pOk = await assetsExist([
    `${ninePRoot}/libv86.mjs`,
    `${ninePRoot}/v86.wasm`,
    `${ninePRoot}/seabios.bin`,
    `${ninePRoot}/vgabios.bin`,
  ]);

  const flatManifestUrl = `${ninePRoot}/alpine-fs.json`;
  if (
    preferredBootMode !== "ext2" &&
    shared9pOk &&
    (await assetExists(flatManifestUrl))
  ) {
    console.log(
      "[WebVM boot] Mode 1: 9p with flat manifest - preferred 9p boot path",
    );

    return {
      mode: "9p",
      label: "9p/virtfs (flat)",
      libUrl: `${ninePRoot}/libv86.mjs`,
      wasmUrl: `${ninePRoot}/v86.wasm`,
      biosUrl: `${ninePRoot}/seabios.bin`,
      vgaBiosUrl: `${ninePRoot}/vgabios.bin`,
      basefsUrl: flatManifestUrl,
      baseurl: `${ninePRoot}/alpine-rootfs-flat/`,
    };
  }

  if (preferredBootMode === "9p") {
    console.log(
      "[WebVM boot] Mode 2: 9p preferred but flat manifest assets not found, skipping 9p boot",
    );

    return null;
  }

  const ext2Ok = await assetsExist([
    `${ext2Root}/libv86.mjs`,
    `${ext2Root}/v86.wasm`,
    `${ext2Root}/seabios.bin`,
    `${ext2Root}/vgabios.bin`,
    `${ext2Root}/alpine-rootfs.ext2`,
    `${ext2Root}/bzImage`,
    `${ext2Root}/initrd`,
  ]);

  if (!ext2Ok) {
    console.log(
      "[WebVM boot] Mode 3: ext2 preferred but assets not found, skipping ext2 boot",
    );

    return null;
  }

  console.log(
    "[WebVM boot] Mode 4: ext2 with all assets found - proceeding with boot",
  );

  return {
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
  if (seededWorkspaceGroups.has(groupId)) {
    return;
  }

  const workspaceDir = await getWorkspaceDir(db, groupId);

  /** @type {string[]} */
  const files = [];
  await collectWorkspaceFiles(workspaceDir, "", files);

  for (const relPath of files) {
    const dirPath = relPath.includes("/")
      ? relPath.slice(0, relPath.lastIndexOf("/"))
      : "";

    if (dirPath) {
      await executeCommand(
        emulator,
        `mkdir -p ${quoteShellPath(`/workspace/${dirPath}`)}`,
        20,
      );
    }

    const bytes = await readWorkspaceFileBytes(workspaceDir, relPath);
    if (!bytes) {
      continue;
    }

    // create_file writes directly into fs9p without serial/base64 overhead.
    await emulator.create_file(`/workspace/${relPath}`, bytes);
  }

  seededWorkspaceGroups.add(groupId);
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

  for (const relPath of vmFiles) {
    const data = await emulator.read_file(`/workspace/${relPath}`);
    if (!data) {
      continue;
    }

    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    await writeWorkspaceFileBytes(workspaceDir, relPath, bytes);
  }
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
      out.push(rel);
    }
  }
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
  const names = fs9p.read_dir(vmDir) || [];
  for (const name of names) {
    const vmPath = `${vmDir}/${name}`.replace(/\/+/g, "/");
    const rel = prefix ? `${prefix}/${name}` : name;

    const children = fs9p.read_dir(vmPath);
    if (Array.isArray(children)) {
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
 * @param {string} path
 *
 * @returns {string}
 */
function quoteShellPath(path) {
  return `'${path.replace(/'/g, `'"'"'`)}'`;
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
    const marker = `__BCDONE_${Date.now()}__`;

    let output = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;

      if (emulator.remove_listener) {
        emulator.remove_listener("serial0-output-byte", listener);
      }

      resolve({ stdout: output, stderr: "", exitCode: 1, timedOut: true });
    }, timeoutSec * 1000);

    /** @param {number} byte */
    const listener = (byte) => {
      const ch = String.fromCharCode(byte);
      output += ch;

      if (output.includes(marker)) {
        clearTimeout(timer);

        if (emulator.remove_listener) {
          emulator.remove_listener("serial0-output-byte", listener);
        }

        const parts = output.split(marker);
        const exitCode = parseInt(parts[1] || "0", 10);

        resolve({
          stdout: parts[0],
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

    emulator.serial0_send(`${command} 2>&1; echo "${marker}$?"\n`);
  });
}
