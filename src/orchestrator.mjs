import {
  ASSISTANT_NAME,
  CONFIG_KEYS,
  CONTEXT_WINDOW_SIZE,
  DEFAULT_GROUP_ID,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROVIDER,
  PROVIDERS,
  buildTriggerPattern,
  getDefaultProvider,
  getProvider,
} from "./config.mjs";

import { BrowserChatChannel } from "./channels/browser-chat.mjs";
import { decryptValue, encryptValue } from "./crypto.mjs";

import { buildConversationMessages } from "./db/buildConversationMessages.mjs";
import { clearGroupMessages } from "./db/clearGroupMessages.mjs";
import { deleteTask } from "./db/deleteTask.mjs";
import { getAllTasks } from "./db/getAllTasks.mjs";
import { getConfig } from "./db/getConfig.mjs";
import { openDatabase } from "./db/openDatabase.mjs";
import { saveMessage } from "./db/saveMessage.mjs";
import { saveTask } from "./db/saveTask.mjs";
import { setConfig } from "./db/setConfig.mjs";

import { playNotificationChime } from "./audio.mjs";
import { Router } from "./router.mjs";
import { readGroupFile } from "./storage/readGroupFile.mjs";
import { TaskScheduler } from "./task-scheduler.mjs";
import { showToast } from "./toast.mjs";
import { ulid } from "./ulid.mjs";

import "./types.mjs";

/**
 * @typedef {import("./db/db.mjs").ShadowClawDatabase} ShadowClawDatabase
 */

/**
 * Simple event emitter for orchestrator events
 */
class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * @param {string} event
   * @param {Function} callback
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  /**
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * @param {string} event
   * @param {any} data
   */
  emit(event, data) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }
}

/**
 * Main orchestrator class
 */
export class Orchestrator {
  constructor() {
    this.events = new EventBus();
    this.browserChat = new BrowserChatChannel();

    /** @type {Router|null} */
    this.router = null;
    /** @type {TaskScheduler|null} */
    this.scheduler = null;
    /** @type {Worker|null} */
    this.agentWorker = null;

    /** @type {'idle'|'thinking'|'responding'} */
    this.state = "idle";
    /** @type {RegExp} */
    this.triggerPattern = buildTriggerPattern(ASSISTANT_NAME);
    /** @type {string} */
    this.assistantName = ASSISTANT_NAME;
    /** @type {string} */
    this.provider = DEFAULT_PROVIDER;
    /** @type {import('./config.mjs').ProviderConfig} */
    this.providerConfig = getDefaultProvider();
    /** @type {string | null} */
    this.apiKey = "";
    /** @type {string} */
    this.model = getDefaultProvider().defaultModel;
    /** @type {number} */
    this.maxTokens = DEFAULT_MAX_TOKENS;
    /** @type {any[]} */
    this.messageQueue = [];
    /** @type {boolean} */
    this.processing = false;
    /** @type {Set<string>} */
    this.pendingScheduledTasks = new Set();
  }

  /**
   * Initialize the orchestrator
   *
   * @returns {Promise<ShadowClawDatabase>}
   */
  async init() {
    // Open database
    const db = await openDatabase();

    // Load config
    this.assistantName =
      (await getConfig(db, CONFIG_KEYS.ASSISTANT_NAME)) || ASSISTANT_NAME;

    this.triggerPattern = buildTriggerPattern(this.assistantName);

    // Load provider
    const storedProvider = await getConfig(db, CONFIG_KEYS.PROVIDER);
    if (storedProvider && getProvider(storedProvider)) {
      this.provider = storedProvider;
      this.providerConfig = getProvider(storedProvider) || getDefaultProvider();
    }

    // Load API key
    let storedKey = await getConfig(db, CONFIG_KEYS.API_KEY);
    if (storedKey) {
      try {
        this.apiKey = await decryptValue(storedKey);
      } catch (_) {
        this.apiKey = "";

        await setConfig(db, CONFIG_KEYS.API_KEY, "");
      }
    }

    // Load model and max tokens
    const storedModel = await getConfig(db, CONFIG_KEYS.MODEL);
    if (storedModel) {
      this.model = storedModel;
    } else {
      this.model = this.providerConfig.defaultModel;
    }

    this.maxTokens = parseInt(
      (await getConfig(db, CONFIG_KEYS.MAX_TOKENS)) ||
        String(DEFAULT_MAX_TOKENS),
      10,
    );

    // Set up router
    this.router = new Router(this.browserChat);

    // Set up channels
    this.browserChat.onMessage((msg) => this.enqueue(db, msg));

    this.agentWorker = new Worker(new URL("../worker.mjs", import.meta.url), {
      type: "module",
    });

    this.agentWorker.onmessage = (event) =>
      this.handleWorkerMessage(db, event.data);

    this.agentWorker.onerror = (err) => {
      console.error("Agent worker error:", err);
    };

    // Pass storage handle if it exists
    const storageHandle = await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE);
    if (storageHandle) {
      this.agentWorker.postMessage({
        type: "set-storage",
        payload: { storageHandle },
      });
    }

    // Set up task scheduler
    this.scheduler = new TaskScheduler(async (task) => {
      if (task.isScript) {
        try {
          return new Function(task.prompt).call(globalThis);
        } catch (err) {
          console.error(`Failed to execute script for task ${task.id}:`, err);
          return;
        }
      }

      // Evaluate template string literals (like ${new Date()}) in prompt
      let evaluatedPrompt = task.prompt;
      try {
        evaluatedPrompt = task.prompt.replace(/\${([^}]+)}/g, (match, expr) => {
          try {
            return new Function(`return ${expr}`)();
          } catch (e) {
            console.warn(`Failed to evaluate expression: ${expr}`, e);
            return match;
          }
        });
      } catch (err) {
        console.warn("Error interpolating task prompt:", err);
      }
      return this.invokeAgent(
        db,
        task.groupId,
        `[SCHEDULED TASK]\n\n${evaluatedPrompt}`,
      );
    });
    this.scheduler.start();

    // Wire up browser chat display callback
    this.browserChat.onDisplay(() => {
      // Display handled via events.emit('message', ...)
    });

    this.events.emit("ready", undefined);

    return db;
  }

  /**
   * Get current state
   *
   * @returns {'idle'|'thinking'|'responding'}
   */
  getState() {
    return this.state;
  }

  /**
   * Check if API key is configured
   *
   * @returns {boolean}
   */
  isConfigured() {
    return this.apiKey ? this.apiKey.length > 0 : false;
  }

  /**
   * Update API key
   *
   * @param {ShadowClawDatabase} db
   * @param {string} key
   *
   * @returns {Promise<void>}
   */
  async setApiKey(db, key) {
    this.apiKey = key;
    const encrypted = await encryptValue(key);

    if (!encrypted) {
      throw new Error("key failed to encrypt. config cannot set.");
    }

    await setConfig(db, CONFIG_KEYS.API_KEY, encrypted);
  }

  /**
   * Get current provider
   * @returns {string}
   */
  getProvider() {
    return this.provider;
  }

  /**
   * Get available providers
   * @returns {Object[]}
   */
  /**
   * @returns {import('./types.mjs').LLMProvider[]}
   */
  getAvailableProviders() {
    return Object.entries(PROVIDERS).map(([id, config]) => ({
      id,
      name: config.name,
      models: [config.defaultModel], // Can be expanded with more models per provider
    }));
  }

  /**
   * Switch to a different provider
   *
   * @param {ShadowClawDatabase} db
   * @param {string} providerId
   *
   * @returns {Promise<void>}
   */
  async setProvider(db, providerId) {
    const newProvider = getProvider(providerId);
    if (!newProvider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    this.provider = providerId;
    this.providerConfig = newProvider;
    this.model = newProvider.defaultModel;
    await setConfig(db, CONFIG_KEYS.PROVIDER, providerId);
    await setConfig(db, CONFIG_KEYS.MODEL, this.model);
  }

  /**
   * Get current model
   *
   * @returns {string}
   */
  getModel() {
    return this.model;
  }

  /**
   * Update model
   *
   * @param {ShadowClawDatabase} db
   * @param {string} model
   *
   * @returns {Promise<void>}
   */
  async setModel(db, model) {
    this.model = model;

    await setConfig(db, CONFIG_KEYS.MODEL, model);
  }

  /**
   * Get assistant name
   * @returns {string}
   */
  getAssistantName() {
    return this.assistantName;
  }

  /**
   * Update assistant name
   *
   * @param {ShadowClawDatabase} db
   * @param {string} name
   *
   * @returns {Promise<void>}
   */
  async setAssistantName(db, name) {
    this.assistantName = name;
    this.triggerPattern = buildTriggerPattern(name);

    await setConfig(db, CONFIG_KEYS.ASSISTANT_NAME, name);
  }

  /**
   * Submit message from browser chat UI
   *
   * @param {string} text
   * @param {string} [groupId]
   */
  submitMessage(text, groupId) {
    this.browserChat.submit(text, groupId);
  }

  /**
   * Start a new session (clears message history)
   *
   * @param {ShadowClawDatabase} db
   * @param {string} [groupId]
   *
   * @returns {Promise<void>}
   */
  async newSession(db, groupId = DEFAULT_GROUP_ID) {
    await clearGroupMessages(db, groupId);

    this.events.emit("session-reset", { groupId });
  }

  /**
   * Compact (summarize) context
   *
   * @param {ShadowClawDatabase} db
   * @param {string} [groupId]
   *
   * @returns {Promise<void>}
   */
  async compactContext(db, groupId = DEFAULT_GROUP_ID) {
    if (!this.apiKey) {
      this.events.emit("error", {
        groupId,
        error: "API key not configured. Cannot compact context.",
      });
      return;
    }

    if (this.state !== "idle") {
      this.events.emit("error", {
        groupId,
        error:
          "Cannot compact while processing. Wait for the current response to finish.",
      });
      return;
    }

    this.setState("thinking");
    this.events.emit("typing", { groupId, typing: true });

    let memory = "";
    try {
      memory = await readGroupFile(db, groupId, "MEMORY.md");
    } catch {
      // No memory file yet
    }

    const messages = await buildConversationMessages(
      groupId,
      CONTEXT_WINDOW_SIZE,
    );
    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    this.agentWorker?.postMessage({
      type: "compact",
      payload: {
        groupId,
        messages,
        systemPrompt,
        apiKey: this.apiKey,
        model: this.model,
        maxTokens: this.maxTokens,
        provider: this.provider,
        storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      },
    });
  }

  /**
   * Shut down everything
   */
  shutdown() {
    this.scheduler?.stop();
    this.agentWorker?.terminate();
  }

  /**
   * @param {'idle'|'thinking'|'responding'} state
   */
  setState(state) {
    this.state = state;
    this.events.emit("state-change", state);
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {import('./types.mjs').InboundMessage} msg
   *
   * @returns {Promise<void>}
   */
  async enqueue(db, msg) {
    // Check trigger
    const isBrowserMain = msg.groupId === DEFAULT_GROUP_ID;
    const hasTrigger = this.triggerPattern.test(msg.content.trim());

    const stored = {
      ...msg,
      isFromMe: false,
      isTrigger: isBrowserMain || hasTrigger,
    };

    if (isBrowserMain || hasTrigger) {
      this.messageQueue.push(msg);
    }

    await saveMessage(db, stored);
    this.events.emit("message", stored);

    this.processQueue(db);
  }

  /**
   * @param {ShadowClawDatabase} db
   *
   * @returns {Promise<void>}
   */
  async processQueue(db) {
    if (this.processing) return;
    if (this.messageQueue.length === 0) return;

    if (!this.apiKey) {
      const msg = this.messageQueue.shift();
      this.events.emit("error", {
        groupId: msg.groupId,
        error: "API key not configured. Go to Settings to add your API key.",
      });

      return;
    }

    this.processing = true;
    const msg = this.messageQueue.shift();

    try {
      await this.invokeAgent(db, msg.groupId, msg.content);
    } catch (err) {
      console.error("Failed to invoke agent:", err);
    } finally {
      this.processing = false;
      if (this.messageQueue.length > 0) {
        this.processQueue(db);
      }
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {string} groupId
   * @param {string} triggerContent
   *
   * @returns {Promise<void>}
   */
  async invokeAgent(db, groupId, triggerContent) {
    this.setState("thinking");
    this.router?.setTyping(groupId, true);
    this.events.emit("typing", { groupId, typing: true });

    // Save scheduled task as client message
    if (triggerContent.startsWith("[SCHEDULED TASK]")) {
      this.pendingScheduledTasks.add(groupId);

      const stored = {
        id: ulid(),
        groupId,
        sender: "Scheduler",
        content: triggerContent,
        timestamp: Date.now(),
        channel: /** @type {import('./types.mjs').ChannelType} */ (
          groupId.startsWith("bg:") ? "browser" : ""
        ),
        isFromMe: false,
        isTrigger: true,
      };

      await saveMessage(db, stored);

      this.events.emit("message", stored);
    }

    // Load group memory
    let memory = "";
    try {
      memory = await readGroupFile(db, groupId, "MEMORY.md");
    } catch {}

    // Build conversation context
    const messages = await buildConversationMessages(
      groupId,
      CONTEXT_WINDOW_SIZE,
    );

    const systemPrompt = buildSystemPrompt(this.assistantName, memory);

    // Send to agent worker
    this.agentWorker?.postMessage({
      type: "invoke",
      payload: {
        groupId,
        messages,
        systemPrompt,
        apiKey: this.apiKey,
        model: this.model,
        maxTokens: this.maxTokens,
        provider: this.provider,
        storageHandle: await getConfig(db, CONFIG_KEYS.STORAGE_HANDLE),
      },
    });
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {any} msg
   *
   * @returns {Promise<void>}
   */
  async handleWorkerMessage(db, msg) {
    switch (msg.type) {
      case "response": {
        const { groupId, text } = msg.payload;
        await this.deliverResponse(db, groupId, text);
        break;
      }

      case "task-created": {
        const { task } = msg.payload;
        try {
          await saveTask(db, task);
          this.events.emit("task-change", { type: "created", task });
        } catch (err) {
          console.error("Failed to save task from agent:", err);
        }

        break;
      }

      case "error": {
        const { groupId, error } = msg.payload;
        await this.deliverResponse(db, groupId, `⚠️ Error: ${error}`);

        break;
      }

      case "typing": {
        const { groupId } = msg.payload;
        this.router?.setTyping(groupId, true);
        this.events.emit("typing", { groupId, typing: true });

        break;
      }

      case "tool-activity": {
        this.events.emit("tool-activity", msg.payload);
        // If a file was written, or bash finished (might have changed files), emit file-change
        if (
          (msg.payload.tool === "write_file" &&
            msg.payload.status === "done") ||
          (msg.payload.tool === "bash" && msg.payload.status === "done")
        ) {
          this.events.emit("file-change", {
            groupId: msg.payload.groupId,
          });
        }

        break;
      }

      case "thinking-log": {
        this.events.emit("thinking-log", msg.payload);

        break;
      }

      case "compact-done": {
        await this.handleCompactDone(
          db,
          msg.payload.groupId,
          msg.payload.summary,
        );

        break;
      }

      case "token-usage": {
        this.events.emit("token-usage", msg.payload);

        break;
      }

      case "task-list-request": {
        const { groupId } = msg.payload;
        const tasks = await getAllTasks(db);
        const groupTasks = tasks.filter((t) => t.groupId === groupId);
        this.agentWorker?.postMessage({
          type: "task-list-response",
          payload: { groupId, tasks: groupTasks },
        });

        break;
      }

      case "update-task": {
        const { task } = msg.payload;
        try {
          await saveTask(db, task);
          this.events.emit("task-change", { type: "updated", task });
        } catch (err) {
          console.error("Failed to update task from agent:", err);
        }

        break;
      }

      case "delete-task": {
        const { id } = msg.payload;
        try {
          await deleteTask(db, id);

          this.events.emit("task-change", { type: "deleted", id });
        } catch (err) {
          console.error("Failed to delete task from agent:", err);
        }

        break;
      }

      case "clear-chat": {
        const { groupId } = msg.payload;
        try {
          await this.newSession(db, groupId);
        } catch (err) {
          console.error("Failed to clear chat from agent:", err);
        }

        break;
      }

      case "show-toast": {
        const { message, type, duration } = msg.payload;
        showToast(message, { type: type || "info", duration });

        break;
      }
    }
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {string} groupId
   * @param {string} summary
   *
   * @returns {Promise<void>}
   */
  async handleCompactDone(db, groupId, summary) {
    await clearGroupMessages(db, groupId);

    const stored = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: `📝 **Context Compacted**\n\n${summary}`,
      timestamp: Date.now(),
      channel: /** @type {import('./types.mjs').ChannelType} */ (
        groupId.startsWith("bg:") ? "browser" : ""
      ),
      isFromMe: true,
      isTrigger: false,
    };

    await saveMessage(db, stored);

    this.events.emit("context-compacted", { groupId, summary });
    this.events.emit("typing", { groupId, typing: false });
    this.setState("idle");
  }

  /**
   * @param {ShadowClawDatabase} db
   * @param {string} groupId
   * @param {string} text
   *
   * @returns {Promise<void>}
   */
  async deliverResponse(db, groupId, text) {
    const stored = {
      id: ulid(),
      groupId,
      sender: this.assistantName,
      content: text,
      timestamp: Date.now(),
      channel: /** @type {import('./types.mjs').ChannelType} */ (
        groupId.startsWith("bg:") ? "browser" : ""
      ),
      isFromMe: true,
      isTrigger: false,
    };

    await saveMessage(db, stored);
    await this.router?.send(groupId, text);

    if (this.pendingScheduledTasks.has(groupId)) {
      this.pendingScheduledTasks.delete(groupId);
      playNotificationChime();
    }

    this.events.emit("message", stored);
    this.events.emit("typing", { groupId, typing: false });

    this.setState("idle");
    this.router?.setTyping(groupId, false);
  }
}

/**
 * Build system prompt
 *
 * @param {string} assistantName
 * @param {string} memory
 *
 * @returns {string}
 */
function buildSystemPrompt(assistantName, memory) {
  const parts = [
    `You are ${assistantName}, a personal AI assistant running in the client's browser.`,
    "",
    "You have access to the following tools:",
    "",
    "### Execution",
    "- **bash**: Execute commands in a sandbox.",
    "- **javascript**: Execute JavaScript code. Lighter than bash.",
    "",
    "### File System",
    "- **read_file**: Read the contents of a file from the group workspace.",
    "- **write_file**: Write content to a file in the group workspace. Creates directories if needed.",
    "- **list_files**: List files and directories in the group workspace.",
    "",
    "### Network",
    "- **fetch_url**: Make HTTP requests (subject to CORS). Returns response body truncated to 100KB.",
    "",
    "### Memory",
    "- **update_memory**: Update the MEMORY.md file to persist important context across conversations.",
    "",
    "### Scheduled Tasks",
    "- **create_task**: Create a scheduled recurring task with a cron expression.",
    "- **list_tasks**: List all scheduled tasks.",
    "- **update_task**: Update a task's schedule or prompt.",
    "- **delete_task**: Delete a scheduled task.",
    "- **enable_task**: Enable a disabled task.",
    "- **disable_task**: Disable a task so it stops running.",
    "",
    "### Session",
    "- **clear_chat**: Clear chat history and start a new session.",
    "",
    "### Git",
    "- **git_clone**: Clone a git repository into browser-persistent storage.",
    "- **git_checkout**: Checkout a branch, tag, or commit.",
    "- **git_status**: Show working tree status.",
    "- **git_log**: Show commit log.",
    "- **git_diff**: Show changed files between refs or HEAD and working tree.",
    "- **git_branches**: List branches in a cloned repo.",
    "- **git_list_repos**: List all cloned repositories.",
    "- **git_add**: Stage specific files or all changes for the next commit.",
    "- **git_commit**: Stage all changes and create a commit.",
    "- **git_push**: Push commits to remote (requires configured PAT).",
    "- **git_pull**: Fetch and merge from remote.",
    "- **git_sync**: Manually sync files between workspace and git database.",
    "",
    "Guidelines:",
    "- Be concise and direct.",
    "- Use tools proactively when they help answer the question.",
    "- Update memory when you learn important preferences or context.",
    "- For scheduled tasks, confirm the schedule with the client.",
    "- The cron expression for a task to be executed once, should be for that exact time.",
    "- Manage tasks. If you create a task, make sure to disable (or delete) it when it's no longer needed.",
    "- Strip <internal> tags from your responses.",
  ];

  if (memory) {
    parts.push("", "## Persistent Memory", "", memory);
  }

  return parts.join("\n");
}
