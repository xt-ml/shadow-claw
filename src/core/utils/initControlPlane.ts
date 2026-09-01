/**
 * ShadowClaw — Control Plane Browser Initialization Helper
 */

import { ControlPlaneClient } from "../control-plane-client.js";
import { getDeploymentNamespace } from "../app-routes.js";
import { getDb } from "../../db/db.js";
import { getAllTasks } from "../../db/getAllTasks.js";
import { ulid } from "../../utils/ulid.js";
import {
  CONFIG_KEYS,
  DEFAULT_CONTROL_PLANE_ENABLED,
  DEFAULT_CONTROL_PLANE_TRANSPORT,
} from "../../config/config.js";
import type { ControlPlaneTransport } from "../../server/control-plane-types.js";

export function getOrCreateControlPlaneClientId(): string {
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(CONFIG_KEYS.CONTROL_PLANE_CLIENT_ID);
      if (stored && stored.trim()) {
        return stored.trim();
      }
    } catch (_) {}
  }

  const namespace = getDeploymentNamespace();
  const generated = namespace
    ? `${namespace}-${ulid().toLowerCase()}`
    : `client-${ulid().toLowerCase()}`;

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(CONFIG_KEYS.CONTROL_PLANE_CLIENT_ID, generated);
    } catch (_) {}
  }

  return generated;
}

export function isControlPlaneEnabledSync(): boolean {
  if (typeof localStorage !== "undefined") {
    try {
      const val = localStorage.getItem(CONFIG_KEYS.CONTROL_PLANE_ENABLED);
      if (val !== null) {
        return val === "true" || val === "1";
      }
    } catch (_) {}
  }
  return DEFAULT_CONTROL_PLANE_ENABLED;
}

export async function isControlPlaneEnabled(db?: any): Promise<boolean> {
  if (typeof localStorage !== "undefined") {
    try {
      const val = localStorage.getItem(CONFIG_KEYS.CONTROL_PLANE_ENABLED);
      if (val !== null) {
        return val === "true" || val === "1";
      }
    } catch (_) {}
  }

  if (db) {
    try {
      const { getConfig } = await import("../../db/getConfig.js");
      const val = await getConfig(db, CONFIG_KEYS.CONTROL_PLANE_ENABLED);
      if (val !== null && val !== undefined) {
        return val === "true" || val === "1";
      }
    } catch (_) {}
  }

  return DEFAULT_CONTROL_PLANE_ENABLED;
}

export function shouldConnectControlPlane(loc?: {
  protocol?: string;
  hostname?: string;
}): boolean {
  if (typeof EventSource === "undefined" && typeof WebSocket === "undefined") {
    return false;
  }

  const currentLoc = loc || (typeof location !== "undefined" ? location : null);
  if (!currentLoc) {
    return false;
  }

  if (currentLoc.protocol === "file:") {
    return false;
  }

  if (
    typeof document !== "undefined" &&
    document.querySelector('meta[name="shadowclaw-static-only"]')
  ) {
    return false;
  }

  return true;
}

export function getControlPlaneServerUrl(loc?: {
  protocol?: string;
  host?: string;
  hostname?: string;
}): { httpUrl: string; wsUrl: string } {
  let customUrl = "";
  if (typeof localStorage !== "undefined") {
    try {
      customUrl = (
        localStorage.getItem(CONFIG_KEYS.CONTROL_PLANE_URL) || ""
      ).trim();
    } catch (_) {}
  }

  const currentLoc = loc || (typeof location !== "undefined" ? location : null);
  const isStaticHost =
    currentLoc &&
    (currentLoc.protocol === "file:" ||
      (currentLoc.hostname &&
        (currentLoc.hostname.endsWith(".github.io") ||
          currentLoc.hostname.endsWith(".pages.dev"))));

  let baseHttp = customUrl;
  if (!baseHttp) {
    if (isStaticHost) {
      baseHttp = "http://127.0.0.1:8888";
    } else if (currentLoc && currentLoc.host) {
      baseHttp = `${currentLoc.protocol}//${currentLoc.host}`;
    } else {
      baseHttp = "http://127.0.0.1:8888";
    }
  }

  baseHttp = baseHttp.replace(/\/+$/, "");

  const baseWs = baseHttp.replace(/^https?:/, (proto) =>
    proto === "https:" ? "wss:" : "ws:",
  );

  return {
    httpUrl: baseHttp,
    wsUrl: `${baseWs}/ws/control`,
  };
}

export function detectCapabilities(): string[] {
  const caps: string[] = [];

  if (typeof navigator !== "undefined") {
    if (
      navigator.storage &&
      typeof navigator.storage.getDirectory === "function"
    ) {
      caps.push("opfs");
    }

    if (
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "PushManager" in window
    ) {
      caps.push("push");
    }

    if (
      (typeof document !== "undefined" && (document as any).modelContext) ||
      ((navigator as any) && (navigator as any).modelContext)
    ) {
      caps.push("webmcp");
    }
  }

  if (typeof RTCPeerConnection !== "undefined") {
    caps.push("peerjs");
  }

  return caps;
}

export function detectDeviceLabel(): string {
  if (typeof navigator === "undefined") {
    return "ShadowClaw Node";
  }

  const ua = navigator.userAgent;
  let device = "Desktop";
  if (/iPad/i.test(ua)) device = "iPad";
  else if (/iPhone/i.test(ua)) device = "iPhone";
  else if (/Android/i.test(ua)) device = "Android";
  else if (/Macintosh/i.test(ua)) device = "Mac";
  else if (/Windows/i.test(ua)) device = "Windows";
  else if (/Linux/i.test(ua)) device = "Linux";

  let browser = "Browser";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Edg/i.test(ua)) browser = "Edge";

  return `${device} ${browser}`;
}

export interface InitControlPlaneOptions {
  orchestrator?: any;
  clientId?: string;
  transport?: ControlPlaneTransport;
  autoConnect?: boolean;
}

let activeClient: ControlPlaneClient | null = null;

export async function executeClientControlCommand(
  action: string,
  args: any = {},
  options: InitControlPlaneOptions = {},
): Promise<any> {
  const clientId = getOrCreateControlPlaneClientId();
  const deviceLabel = detectDeviceLabel();
  const capabilities = detectCapabilities();

  switch (action) {
    case "send-message": {
      if (!args.text) {
        throw new Error("Missing text parameter");
      }
      const { orchestratorStore } =
        await import("../../stores/orchestrator.js");
      const orch = options.orchestrator || orchestratorStore.orchestrator;
      const targetGroupId =
        args.groupId || orchestratorStore.activeGroupId || "br:main";

      if (orch?.browserChat?.submit) {
        orch.browserChat.submit(args.text, targetGroupId);
        return { queued: true, groupId: targetGroupId };
      }
      if (orch?.submitMessage) {
        orch.submitMessage(args.text, targetGroupId);
        return { queued: true, groupId: targetGroupId };
      }
      if (orchestratorStore.sendMessage) {
        orchestratorStore.sendMessage(args.text);
        return { queued: true, groupId: targetGroupId };
      }
      return { queued: false, error: "Orchestrator not ready" };
    }

    case "list-tasks": {
      const db = await getDb();
      let tasks = await getAllTasks(db);
      if (args?.groupId) {
        tasks = tasks.filter((t) => t.groupId === args.groupId);
      }
      return { tasks };
    }

    case "read-state": {
      const { orchestratorStore } =
        await import("../../stores/orchestrator.js");
      const orch = options.orchestrator || orchestratorStore.orchestrator;
      return {
        clientId,
        deviceLabel,
        capabilities,
        activeGroupId:
          options.orchestrator?.activeGroupId ||
          orchestratorStore.activeGroupId ||
          orch?.activeGroupId ||
          "br:main",
        state:
          options.orchestrator?.state ||
          orchestratorStore.state ||
          orch?.state ||
          "idle",
      };
    }

    case "invoke-tool": {
      if (!args.toolName) {
        throw new Error("Missing toolName parameter");
      }
      const ctx =
        (typeof document !== "undefined" && (document as any).modelContext) ||
        (typeof navigator !== "undefined" && (navigator as any).modelContext);

      const result = await ctx.invoke(args.toolName, args.input);
      return { result };
    }

    case "trigger-backup": {
      const { orchestratorStore } =
        await import("../../stores/orchestrator.js");
      const targetGroupId =
        args.groupId ||
        options.orchestrator?.activeGroupId ||
        orchestratorStore.activeGroupId ||
        "br:main";
      const db = await getDb();
      const { getGroupDir } = await import("../../storage/getGroupDir.js");
      const groupDir = await getGroupDir(db, targetGroupId);

      async function collectFiles(
        dir: FileSystemDirectoryHandle,
        prefix = "",
      ): Promise<string[]> {
        const result: string[] = [];
        for await (const [name, handle] of (dir as any).entries()) {
          const relPath = prefix ? `${prefix}/${name}` : name;
          if (handle.kind === "directory") {
            const sub = await collectFiles(handle, relPath);
            result.push(...sub);
          } else {
            result.push(relPath);
          }
        }
        return result;
      }

      async function readFile(relPath: string): Promise<Uint8Array | null> {
        try {
          const parts = relPath.split("/");
          let cur: FileSystemDirectoryHandle = groupDir;
          for (let i = 0; i < parts.length - 1; i++) {
            cur = await cur.getDirectoryHandle(parts[i]);
          }
          const fileHandle = await cur.getFileHandle(parts[parts.length - 1]);
          const file = await fileHandle.getFile();
          const buffer = await file.arrayBuffer();
          return new Uint8Array(buffer);
        } catch {
          return null;
        }
      }

      const { BackupController } = await import("../backup-controller.js");

      const backupCtrl = new BackupController({
        clientId,
        token: args.token,
        serverBaseUrl: getControlPlaneServerUrl().httpUrl,
        fileEnumerator: () => collectFiles(groupDir),
        fileReader: (filePath) => readFile(filePath),
      });

      const result = await backupCtrl.initiate();
      return result;
    }

    default:
      throw new Error(`Unknown action '${action}'`);
  }
}

export function createDefaultControlPlaneClient(
  options: InitControlPlaneOptions = {},
): ControlPlaneClient {
  if (activeClient) {
    try {
      activeClient.disconnect();
    } catch (_) {}
    activeClient = null;
  }

  const clientId =
    (options.clientId && options.clientId.trim()) ||
    getOrCreateControlPlaneClientId();
  const capabilities = detectCapabilities();
  const deviceLabel = detectDeviceLabel();

  let configuredTransport: ControlPlaneTransport | null = null;
  if (typeof localStorage !== "undefined") {
    try {
      const stored = localStorage.getItem(CONFIG_KEYS.CONTROL_PLANE_TRANSPORT);
      if (stored === "sse" || stored === "websocket") {
        configuredTransport = stored;
      }
    } catch (_) {}
  }

  const transport =
    options.transport ||
    configuredTransport ||
    (DEFAULT_CONTROL_PLANE_TRANSPORT as ControlPlaneTransport);

  let peerId: string | undefined;
  if (typeof localStorage !== "undefined") {
    try {
      // CONFIG_KEYS.PEERJS_MY_PEER_ID is "peerjs_my_peer_id" — set by configurePeerJs via setConfig.
      // We also check the raw IndexedDB config key written by setConfig, which mirrors to localStorage
      // under the same key name in browser environments that support it.
      peerId = localStorage.getItem(CONFIG_KEYS.PEERJS_MY_PEER_ID) || undefined;
    } catch (_) {}
  }

  const { httpUrl, wsUrl } = getControlPlaneServerUrl();

  const client = new ControlPlaneClient({
    clientId,
    deviceLabel,
    capabilities,
    peerId,
    transport,
    httpUrl,
    url: wsUrl,
    handlers: {
      "send-message": (args: any) =>
        executeClientControlCommand("send-message", args, options),
      "list-tasks": (args: any) =>
        executeClientControlCommand("list-tasks", args, options),
      "read-state": (args: any) =>
        executeClientControlCommand("read-state", args, options),
      "invoke-tool": (args: any) =>
        executeClientControlCommand("invoke-tool", args, options),
      "trigger-backup": (args: any) =>
        executeClientControlCommand("trigger-backup", args, options),
    },
  });

  if (options.autoConnect !== false && shouldConnectControlPlane()) {
    client.connect();
  }

  activeClient = client;
  return client;
}

export function getActiveControlPlaneClient(): ControlPlaneClient | null {
  return activeClient;
}

export function stopControlPlaneClient(): void {
  if (activeClient) {
    try {
      activeClient.disconnect();
    } catch (_) {}
    activeClient = null;
  }
}
