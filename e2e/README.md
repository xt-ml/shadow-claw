# ShadowClaw E2E & Integration Test Architecture

Comprehensive testing guide for ShadowClaw covering the **browser-native E2E test suite** (Playwright Page Object Model) and the **server-side headless agent integration tests** (Jest).

## Architecture Overview

ShadowClaw features a **dual test architecture** tailored to its two runtime modes:

1. **Browser E2E Test Suite (`e2e/`)**: Powered by Playwright using the Page Object Model (POM). Validates frontend user interfaces, Web Components, reactive signals, Web Worker orchestrator loops, sandboxed OPFS/IndexedDB storage, WebVM/just-bash shell emulation, and PWA/Electron workflows.
2. **Server-Side Headless Agent & CLI Integration Tests (`src/cli/` & `src/`)**: Powered by Jest. Validates the host-native CLI agent participant (`shadow-claw agent run`), direct tool inspection and execution (`shadow-claw agent tools`, `shadow-claw agent tool`), SQLite database storage (`src/db/sqlite/`), Node filesystem handle abstraction (`src/storage/node-fs-handle.ts`), and headless tool capability execution (`src/worker/utils/executeTool.headless.test.ts`).

### Browser E2E Directory Structure

e2e/
├── components/ # Reusable component objects for UI regions
│ ├── nav.component.ts # Navigation between pages + settings, auth, and back to chat
│ ├── message-input.component.ts # Message input field + send button
│ ├── chat-actions.component.ts # Chat actions (stop, clear, new conversation)
│ ├── file-browser.component.ts # File browser component
│ └── conversations.component.ts # Conversations list and conversation-selection logic
├── pages/ # Page objects representing app views
│ ├── app.page.ts # Root app + navigation
│ ├── chat.page.ts # Chat interface
│ ├── files.page.ts # Files browser
│ ├── tasks.page.ts # Task scheduler
│ └── settings.page.ts # Settings panel
├── shared/ # Low-level utilities and helpers
│ └── index.ts # DB helpers, constants, wait functions
├── fixtures.ts # Shared test fixtures (app, chat, files, tasks, settings, conversations)
├── \*.test.ts # Test suites
│ └── chat.test.ts # Chat interface verification
│ └── conversations.test.ts # Conversation CRUD + delete-dialog keyboard accessibility
│ └── files.test.ts # File browser upload + file/folder creation operations
│ └── navigation.test.ts # App-level navigation and page switching
│ └── settings.test.ts # Settings persistence (max iterations, streaming, assistant name)
│ └── streaming-chat.test.ts # Chat flow with mock SSE streaming + non-streaming
│ └── task-crud.test.ts # Task CRUD (create, edit, toggle, delete)
│ └── tasks.test.ts # Task interface and toggle verification
│ └── file-viewer.test.ts # File viewer component integration coverage
│ └── share-target.test.ts # Web Share Target import flow
│ └── orchestrator.test.ts # System integration coverage
│ └── storage.test.ts # System integration coverage
└── README.md # This file

## Security and Test Bridge

ShadowClaw production builds are hardened against unauthorized access and environment manipulation. To maintain testability without compromising security, the system uses a dedicated **E2E Test Bridge**.

### Global Hardening

Browser APIs like `fetch` and `crypto.subtle` are locked (`non-configurable`, `non-writable`) to prevent monkey-patching.

### The E2E Bridge (`__SHADOWCLAW_E2E__`)

During testing, Playwright enables the bridge by setting `window.__SHADOWCLAW_E2E_ENABLE__ = true` with `page.addInitScript(...)` before app bootstrap. When enabled, the app installs a secure bridge on `window.__SHADOWCLAW_E2E__`. This bridge is the **exclusive** way for tests to interact with internal state.

Example setup:

```js
await page.addInitScript(() => {
  window.__SHADOWCLAW_E2E_ENABLE__ = true;
});
```

**Available Bridge Methods:**

- `isReady()`: Returns `store.ready` status.
- `getDb()`: Returns the live IndexedDB handle.
- `getActiveGroupId()`: Returns the current conversation ID.
- `configureProvider(id, key, model, streaming)`: Rapidly configures the orchestrator for testing.
- `createConversation(name)` / `switchConversation(id)` / `loadTasks()`: High-level store wrappers.

### Testing and Environment Locking

Environment locking is **automatically disabled** during E2E runs to allow Playwright's network interception and mocking. However, tests should still verify that the production security guards are in place where applicable.

## Core Principles

### 1. **Page Object Model (POM)**

- **Page Objects** (`pages/*`) represent full application views and orchestrate component objects
- **Component Objects** (`components/*`) represent reusable UI regions (nav bar, chat actions, file browser)
- Tests interact with **intent-based methods** (e.g., `chat.sendMessage()`) rather than raw selectors

### 2. **Fixtures Over Setup Boilerplate**

All tests use shared fixtures from `fixtures.ts`:

```js
import { test, expect } from "./fixtures.js";

test("example", async ({ app, chat }) => {
  // app is already initialized and ready
  await chat.open();
  await chat.sendMessage("Hello!");
});
```

**Available Fixtures:**

- `app` — Root `AppPage`, auto-navigated to `/` and ready
- `chat` — `ChatPage` instance (requires `.open()` to navigate)
- `files` — `FilesPage` instance
- `tasks` — `TasksPage` instance
- `settings` — `SettingsPage` instance (requires `.open()` to navigate)
- `conversations` — `ConversationsComponent` instance (sidebar conversation list)
- `page` — Raw Playwright `Page` (for low-level browser API checks)

### 3. **Component Composition**

Page objects compose smaller component objects for reusability:

```js
// chat.page.ts
import { MessageInputComponent } from "../components/message-input.component.ts";

export class ChatPage {
  constructor(app) {
    this.messageInput = new MessageInputComponent(this.host);
  }

  async sendMessage(text) {
    await this.messageInput.fillAndSend(text);
  }
}
```

### 4. **No Raw `page.evaluate` in Tests**

Avoid `page.evaluate()` for normal DOM interaction and assertions. Instead:

- ✅ Use page object methods: `chat.messageCount()`
- ✅ Use component locators: `chat.messages()`
- ❌ Avoid: `page.evaluate(() => document.querySelector(...))`

Use `page.evaluate()` only when you need browser-only APIs or app-internal bridge/state access that page objects cannot represent cleanly (for example IndexedDB/OPFS checks, share-target setup, or orchestrator bridge checks).

## Writing Tests

### Test Structure

```js
import { test, expect } from "./fixtures.js";

test.describe("Feature Name", () => {
  test("should do something", async ({ chat }) => {
    await chat.open();
    await chat.sendMessage("Test message");

    expect(await chat.messageCount()).toBe(1);
  });
});
```

### Using Components

For granular control, access component objects directly:

```js
test("should validate input", async ({ chat }) => {
  await chat.open();

  // Use component directly
  await chat.messageInput.fill("Draft message");
  await chat.messageInput.expectSendEnabled();

  // Or use convenience methods
  await chat.fillMessage("Another message");
});
```

### Navigation Patterns

```js
// Navigate via app fixture
test("multi-page flow", async ({ app, chat, files }) => {
  await app.navigateTo("chat");
  // interact with chat

  await app.navigateTo("files");
  // interact with files
});

// Or use page.open()
test("direct navigation", async ({ chat }) => {
  await chat.open(); // navigates to chat and waits for ready
});
```

## Component Object Guide

### `NavComponent`

Handles app-level navigation and page switching.

**Methods:**

- `navigateTo(pageId)` — Click nav item and wait for page activation
- `currentPageId()` — Get active page ID
- `navItemCount()` — Count navigation items
- `isPageActive(pageId)` — Check if a page is currently active

### `MessageInputComponent`

Manages chat message input, attachment button, and send button.

**Methods:**

- `fill(text)` — Type into textarea
- `send()` — Click send button
- `attach()` — Click file attachment button
- `fillAndSend(text)` — Combined fill + send
- `placeholder()` — Get placeholder text
- `expectVisible()` — Assert textarea and buttons are visible
- `expectSendEnabled()` / `expectSendDisabled()` — Assert button state

### `ChatActionsComponent`

Provides backup/restore/compact/clear operations.

**Methods:**

- `downloadButton()`, `restoreButton()`, `compactButton()`, `clearButton()` — Locators
- `expectAllActionsPresent()` — Assert all action buttons exist
- `downloadChat()`, `clearChat()`, `compactChat()` — Action methods

### `ConversationsComponent`

Manages sidebar conversation CRUD operations.

**Methods:**

- `host()` — Locator for `<shadow-claw-conversations>`
- `items()` — All conversation items in the list
- `item(groupId)` — Specific conversation item by group ID
- `activeItem()` — The currently active (selected) conversation
- `itemName(locator)` — Get name text of a conversation item
- `createButton()` — The "+" create conversation button
- `createDialog()` — Create conversation dialog
- `createInput()` — Create dialog input field
- `createOkButton()` — Create dialog confirm button
- `renameButton(itemLocator)` — Rename button (visible on hover)
- `renameDialog()` — Rename dialog
- `renameInput()` — Rename dialog input field
- `renameOkButton()` — Rename dialog confirm button
- `deleteButton(itemLocator)` — Delete button (visible on hover)
- `deleteDialog()` — Delete confirm dialog
- `deleteOkButton()` — Delete confirm button
- `deleteCancelButton()` — Delete cancel button
- `count()` — Count of conversations
- `activeConversationName()` — Name of the active conversation
- `expectCount(count)` — Assert a specific number of conversations
- `createConversation(name)` — Create a conversation via the create dialog
- `renameConversation(itemLocator, name)` — Rename an existing conversation
- `deleteConversation(itemLocator, confirmDelete)` — Delete or cancel delete

### `FileBrowserComponent`

Handles file list, breadcrumbs, and upload UI.

**Methods:**

- `fileList()`, `breadcrumbs()`, `uploadButton()`, `backupButton()` — Locators
- `fileItem(name)` — Locate specific file by name
- `expectCoreUi()` — Assert file list and upload controls are present
- `navigateToBreadcrumb(index)` — Click breadcrumb link

Behavior notes:

- Files view supports drag-and-drop uploads and shows an in-panel upload progress bar.
- New-item dialog supports creating either a file or a folder via the `Create as folder` toggle.
- `Host -> VM` and `VM -> Host` sync buttons are mode-gated; they render only when VM mode is `9p`.

### Tools Configuration Elements

The `<shadow-claw-tools>` component includes interactive controls for managing tool configuration:

- **Internet Access Toggle** (`.tools__internet-access-toggle` / `#toolsInternetAccessOptIn`): A checkbox to toggle the shared full public internet access setting (`vm_bash_full_internet_access`) for both `bash` and `javascript` tools.
- **Web Search Proxy Toggle & Settings**: Checkbox (`.tools__web-search-proxy-toggle`), custom CORS proxy endpoint input (`.tools__web-search-proxy-input`), and custom search URL template input (`.tools__web-search-template-input`) to configure search routing for `web_search`.
- **Declarative Tool Toggles & Badges**: Checkboxes (`.tools__declarative-tool-toggle`) and `"declarative"` badges allowing independent enablement/disablement of declarative tools discovered in `.agents/tools/main/`.
- **Remote Tool & Skill Importer (`.tools__import-btn` / `#toolsImportBtn`)**:
  - Launches the Remote Tool Import modal (`.tools-import-modal`).
  - Source URL input (`.tools-import-input`) and quick-pick presets selector (`.tools-import-preset-select`) targeting RFC v0.2.0 manifests (`/.well-known/agent-skills/index.json`).
  - Discovery catalog inspection with category tabs (tools, skills, scripts), item cards, checkbox selections, and expandable schema/code preview drawers (`.tools-import-detail-dialog`).
  - Options for automatic enablement of imported tools (`#toolsImportAutoEnable`) and destination overwrite toggle (`#toolsImportOverwrite`).
  - Executes batch downloading, SHA-256 integrity verification, and OPFS persistence to `.agents/tools/main/`, `.agents/skills/main/`, and `.agents/scripts/main/`.
  - Testing considerations: mock remote manifest endpoints via Playwright route interception (`page.route('**/.well-known/agent-skills/index.json', ...)`) and verify OPFS persistence via the `__SHADOWCLAW_E2E__` bridge.
- **WebMCP Toggle** (`.tools__webmcp-toggle`): Toggles integration with browser's Model Context Protocol.
- **WebMCP Mode selector** (`.tools__webmcp-mode`): Selects the WebMCP execution mode.

## Page Object Guide

### `AppPage`

Root application controller. Automatically initialized by `app` fixture.

**Properties:**

- `page` — Playwright Page
- `root` — `shadow-claw` root locator
- `nav` — `NavComponent` instance

**Methods:**

- `open()` — Navigate to `/` and wait for app ready
- `waitForReady()` — Wait for custom element definition + active page
- `navigateTo(pageId)` — Delegate to `nav.navigateTo()`
- `navigateToWithOpenDialog(pageId)` — Navigate via app API when a dialog is open (including wrapped native `<dialog>` usage)
- `currentPageId()` — Get active page ID
- `chatComponent()`, `filesComponent()`, `tasksComponent()`, `toolsComponent()`, `toastComponent()` — Component locators

### `ChatPage`

Chat interface controller.

**Properties:**

- `messageInput` — `MessageInputComponent`
- `actions` — `ChatActionsComponent`

**Methods:**

- `open()` — Navigate to chat page
- `fillMessage(text)` — Fill message input
- `sendMessage(text)` — Fill and send message
- `messageCount()` — Count rendered messages
- `expectCoreUi()` — Assert input, send button, and message container exist

Behavior notes:

- Chat can show a transient model download progress panel when using Prompt API or Transformers.js Browser providers.
- Assertions around that panel should be state-based (present/hidden) and not rely on fixed timing.
- **Prompt API Testing**: When testing the native browser Prompt API, ensure the onboarding dialog bypass logic works and fallback model selection UI is properly hidden when the native hardware API is available.
- **Transformers.js Testing**: Verify chunked model download progress estimation (via Hugging Face tree API), local inference (defaulting to `q4f16`), and dynamic Jinja chat-template parsing when using local models.
- **Provider Help Dialogs**: When a provider request fails, the application may display a contextual help dialog. Use `app.navigateToWithOpenDialog()` to test flows that interrupt navigation with dialogs, or verify dialog content via standard locators on the `.app-dialog` component.
- **Attachment Capabilities**: When testing file attachments, keep in mind that the application dynamically selects native vs. fallback delivery based on model capabilities (`src/content/attachment-capabilities.ts`).
- **Confirmation Flows**: Destructive chat actions (for example message delete and compact) use app-level dialogs, so tests should assert dialog behavior rather than native `window.confirm()`.
- **Subagent Testing**: Subagent invocations run in a parallel, isolated worker context. Verify concurrency limits (`SUBAGENT_MAX_PARALLEL`) and correct execution routing without polluting the parent agent's message history.
- **Subagent Workspace/Model Policy Testing**: Verify `SUBAGENT_WORKSPACE_MODE` behavior (`automatic`, `parent`, `isolated`) and conversation-level subagent selection policy (`automatic` vs `manual` pinned provider/model) route to the expected workspace and model.
- **Provider Runtime Override Testing**: For conversation-level overrides, verify Bedrock proxy (`authMode`, `profile`, `region`) and Llamafile (`host`, `mode`, `offline`, `port`) values propagate to runtime headers and provider calls.
- **Shared State Testing**: For Multi-Agent flows, verify that `STATE_SNAPSHOT` and `STATE_DELTA` events correctly synchronize state across participants and properly render in the UI.
- **`ask_user` Testing**: When the agent calls `ask_user`, the worker blocks on a pending promise until the UI sends back an `ask-user-response` message containing the user's answer. E2E tests that trigger this flow must simulate that postMessage dispatch to unblock the agent; otherwise the invocation will hang.
- **Skill Slash Commands & Declarative Tool Chains**: Slash commands like `/toast-random-number` or `/skill-creator` trigger skill workflows directly. For declarative skills with `execution: { type: "tools", tools: [...] }`, execution dispatches to `executeToolChain` on the worker thread without calling LLM providers. E2E tests can trigger slash commands via `chat.sendMessage("/skill-name")` and verify target side-effects (e.g. toasts, chat text) while respecting `suppressToast` and `suppressOutput` settings.

### `FilesPage`

File browser controller.

**Properties:**

- `browser` — `FileBrowserComponent`

**Methods:**

- `open()` — Navigate to files page
- `fileList()`, `uploadButton()`, `fileInput()`, `breadcrumbs()` — Delegate to browser component
- `allButtons()` — Return all file-page buttons

### `TasksPage`

Task scheduler controller.

**Methods:**

- `open()` — Navigate to tasks page
- `allButtons()`, `textInputs()`, `toggles()` — Locator helpers
- `taskLikeElements()` — Query task-related DOM nodes
- `createTask(schedule, prompt, options)` — Create a task via the add-task dialog (supports `freshContext` and `subagent` options)

### `SettingsPage`

Settings panel controller.

**Methods:**

- `open()` — Navigate to settings page
- `expandAiSettings()` — Expand AI section when collapsed
- `expandModelProviderSettings()` — Expand Model Provider section when collapsed
- `llm()` — LLM settings sub-component locator
- `maxIterationsInput()` — Max iterations number input
- `saveMaxIterationsButton()` — Save max iterations button
- `streamingToggle()` — Streaming toggle checkbox
- `providerSelect()` — Provider select dropdown
- `modelSelect()` — Model select dropdown
- `apiKeyInput()` — API key input
- `saveApiKeyButton()` — Save provider / API key button
- `assistantNameInput()` — Assistant name input
- `saveAssistantNameButton()` — Save assistant name button
- `overridePrerenderSkeletonToggle()` — Override pre-rendered skeleton toggle checkbox (`OVERRIDE_PRERENDER_SKELETON`)
- `sidebarPagesHiddenToggle()` — Toggle visibility for Pages navigation item in sidebar
- `sidebarChatHiddenToggle()` — Toggle visibility for Chat navigation item in sidebar
- `sidebarTasksHiddenToggle()` — Toggle visibility for Tasks navigation item in sidebar
- `sidebarFilesHiddenToggle()` — Toggle visibility for Files navigation item in sidebar
- `taskServerConfig()` — Task server configuration component (`<shadow-claw-task-server>`)
- `controlPlaneConfig()` — Control plane configuration component (`<shadow-claw-control-plane>`)

## Shared Utilities (`shared/index.ts`)

### Constants

```js
export const appUrl = "http://localhost:8888";
export const TIME_SECONDS_ONE = 1000;
export const TIME_SECONDS_FIVE = 5000;
export const TIME_MINUTES_ONE = 60000;
```

### Helpers

- `getRunId()` — Generate unique run IDs for test artifacts
- `getAllGroupIds(page)` — Fetch IndexedDB session group IDs
- `waitForShadowClaw(page)` — Legacy helper (prefer `app.waitForReady()`)
- `navigateToPage(page, pageId)` — Legacy helper (prefer `app.navigateTo()`)

## Best Practices

### ✅ DO

- Use fixtures (`app`, `chat`, `files`, `tasks`) instead of manual setup
- Use page object methods for all interactions
- Compose page objects from component objects
- Write intent-driven assertions: `expect(await chat.messageCount()).toBe(2)`
- Use `toHaveCount()` instead of `toBeVisible()` for custom element hosts (they use `display: contents`)
- For mode-gated controls (for example VM sync buttons), assert hidden/visible state based on runtime VM mode
- Feature-gate tests that rely on browser-specific APIs (OPFS, IndexedDB)
- Feature-gate Prompt API flows when `LanguageModel` is unavailable in the browser build
- Isolate the application's runtime environment from the Service Worker in tests to prevent intermittent failures caused by background reloads or "controlling" state changes.
- For Prompt API UI checks, assert API-key input disablement and provider helper text in Settings
- For Provider Help dialogs, mock provider errors to trigger the dialogs and verify the contextual instructions and links.
- **Remote MCP Testing**: Verify tool discovery, execution, and automatic OAuth reconnection flows by mocking streamable HTTP responses and OAuth failure modes.
- **Proxy Security Testing**: Verify that the `/proxy` endpoint rejects non-HTTP/S schemes (`file:`, `ftp:`, etc.) with `400` and blocks private/loopback IP targets (`localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`) with `403`. Use the unit tests in `src/server/utils/proxy-helpers.test.ts` for scheme and SSRF guard coverage; E2E tests should verify that the authenticated service-worker format (body-based JSON with `Content-Type: application/json`) is still allowed to reach local tool servers.
- **Page Navigation Testing**: When testing pages or file viewer navigation, ensure keyboard events (`ArrowLeft`/`ArrowRight`) are properly guarded and do not trigger when the active element is an input or content-editable. Swipe gestures can be simulated using mouse events (`mousedown`, `mousemove`, `mouseup`) or touch events; ensure drag/text-selection does not trigger a false swipe. Assert that same-origin links are validated via `isPossibleAppRoute` so non-app routes (e.g. standalone demo subpaths) bypass SPA navigation and trigger native browser navigation (`window.open`).
- **Sidebar Visibility & Fallback Testing**: When verifying sidebar toggle controls, assert that hiding the currently active view triggers automatic navigation to the next available visible view (`getDefaultSidebarPage`).
- **Custom Element Guard Testing**: When testing custom elements in E2E or unit suites, verify that registering unapproved custom element tags throws a security error and DOM injection of unapproved custom element tags results in immediate removal by the DOM mutation guard. For custom element script descriptors (`customElements.scripts`), verify that object entries (`{ src, hasInit }`) are correctly parsed alongside legacy URLs, and `init()` is executed exclusively when `hasInit: true`.
- **Sandboxed Iframe & Storage Proxy Testing**: Verify preview iframe navigation and storage bridges in `file-viewer-preview-bridge.js` and `iframe-storage-bridge.js`. Assert that link clicks and programmatic navigation (`location.href`, `location.assign()`, `location.replace()`) relay navigation messages to the parent frame via `postMessage`, rebuilding the iframe `srcdoc` with injected `location.search` parameters before custom element scripts execute. Assert that `IndexedDB` and `localStorage` CRUD operations are proxied via `shadow-claw-storage-proxy` to parent storage, `showOpenFilePicker` and `showSaveFilePicker` degrade gracefully to input/download triggers, ServiceWorker/caches getters are trapped without `SecurityError` rejections, and `IframeBroadcastProxy` relays BroadcastChannel messages while suppressing command echo feedback loops via `isRelayingCommandFromParent`.

### ❌ DON'T

- Hard-code selectors in test files
- Use `page.evaluate()` for DOM queries (use page objects instead)
- Call `page.goto()` directly (use `app.open()` or `chat.open()`)
- Skip tests without a clear, documented reason
- Use `toBeVisible()` on `<shadow-claw>` or other custom element hosts

## Running Tests

```bash
# Run all E2E tests
npm run e2e

# Run specific test file
npm run e2e -- chat.test.ts

# Run with UI mode (interactive debugging)
npm run e2e -- --ui

# Run with specific browser
npm run e2e -- --project=chromium

# Generate HTML report
npm run e2e -- --reporter=html
```

### Build, CLI & Headless Agent Regression Tests

The build, CLI, prerender, and headless agent test suites live under `src/cli/` and `src/` and run through the project Jest configuration. Coverage includes:

- **CLI Commands & Utilities**: `build`, `dev`, `run`, `serve`, `server`, `init`, `clients`, `send`, `backup`, `tasks`, `mcp`, `skills:index`, `webrtc`, `peer-id`, `--version`, `agent` (`src/cli/commands/agent.test.ts`), and `agent model` (`src/cli/commands/agent-models.test.ts`).
- **Model Download & Progress Bar Utilities**: Hugging Face ONNX model querying, downloading, and local caching (`src/cli/utils/local-models.test.ts`), terminal progress bar (`src/cli/utils/progress-bar.test.ts`), and cache directory resolution (`src/cli/utils/resolve-cache-dir.test.ts`).
- **Headless Agent Subsystems**: SQLite database implementation (`src/db/sqlite/*.test.ts`), Node.js filesystem directory handle polyfill (`src/storage/node-fs-handle.test.ts`), headless tool execution and capability matrix (`src/worker/utils/executeTool.headless.test.ts`, `src/worker/tools/builtin-ai/builtin-ai.headless.test.ts`), and default provider/model configuration (`src/config/headless.test.ts`).
- **Host-Native Offline Model Executors**: In-process Node.js Transformers.js execution (`src/worker/tools/node-transformers-executor.test.ts`, `src/server/services/transformers-runtime.test.ts`), Llamafile manager & executor (`src/worker/tools/node-llamafile-executor.test.ts`, `src/server/services/llamafile-manager.test.ts`), and agent invocation loop (`src/worker/utils/handleInvoke.test.ts`).

```bash
NODE_OPTIONS="--no-warnings --experimental-vm-modules" \
  npx jest --runInBand src/cli/cli.test.ts \
  src/cli/commands/agent.test.ts \
  src/cli/commands/agent-models.test.ts \
  src/cli/utils/local-models.test.ts \
  src/cli/utils/progress-bar.test.ts \
  src/cli/commands/peer-id.test.ts \
  src/cli/commands/mcp.test.ts \
  src/cli/commands/skills-index.test.ts \
  src/cli/utils/control-client.test.ts \
  src/cli/utils/webrtc-control-client.test.ts \
  src/cli/build/build.test.ts \
  src/cli/prerender/dsd-shell/prerender-dsd-shell.test.ts \
  src/cli/prerender/pretty-paths/prerender-pretty-paths.test.ts \
  src/db/sqlite/openSqliteDatabase.test.ts \
  src/storage/node-fs-handle.test.ts \
  src/worker/utils/executeTool.headless.test.ts \
  src/worker/tools/node-transformers-executor.test.ts \
  src/worker/tools/node-llamafile-executor.test.ts \
  src/worker/utils/handleInvoke.test.ts \
  src/config/headless.test.ts
```

## Debugging Tips

### Visual Debugging

```bash
# Interactive mode with time travel debugging
npm run e2e -- --ui

# Headed mode (see browser)
npm run e2e -- --headed

# Slow motion
npm run e2e -- --headed --slow-mo=500
```

### Locator Debugging

Use Playwright's inspector:

```js
await page.pause(); // breakpoint
```

Or use the `locator.highlight()` method:

```js
await chat.sendButton().highlight();
```

### Screenshot on Failure

Screenshots are automatically captured on failure and saved to `e2e-results/`.

## Prompt API and Browser Capability Gates

Some runtime paths are browser-capability dependent and should be handled similarly
to storage feature gates.

- Prompt API provider depends on `globalThis.LanguageModel` support.
- WebMCP integration depends on `document.modelContext` support (with `navigator.modelContext` fallback for Chrome < 152, where `navigator.modelContext` was deprecated in Chrome 150 and removed in Chrome 152.0.7943.0). Input schemas support native JavaScript objects (Chrome 154+) and DOMString JSON (Chrome < 154) via `parseWebMcpInputSchema`, and `getWebMcpTools()` degrades gracefully to `[]` when `getTools()` is unavailable.
- In unsupported browsers, tests should verify graceful fallback/error messaging,
  not hard-fail on unavailable platform features.

## Storage Tests (Feature-Gated)

Storage integration tests (`storage.test.ts`) and migration tests (`migrateLegacyDatabase.test.ts`) verify per-deployment storage namespacing (`namespacedStorage`, `shadowclaw_<namespace>`, `shadow-claw-opfs-<namespace>`) and are **feature-gated** at runtime:

- Tests skip if `indexedDB` or `navigator.storage` are unavailable
- This is intentional — not all browsers/contexts support OPFS
- Do not remove these skips or force the tests to fail

**Why they skip:**

- WebKit/Safari may not support OPFS `getDirectory()`
- Security contexts (non-HTTPS, iframes) may block IndexedDB
- The suite gracefully degrades instead of failing noisily

## Contributing

### Adding a New Page

1. Create page object in `pages/<name>.page.ts`
2. Add fixture to `fixtures.ts`
3. Create test suite `<name>.test.ts`
4. Document selectors and methods in this README

### Adding a New Component

1. Create component in `src/components/shadow-claw-<name>/shadow-claw-<name>.ts` (declare `static observedAttributes` if reacting to attribute changes)
2. Export component from `src/components/index.ts`
3. Add co-located Storybook story in `src/components/shadow-claw-<name>/shadow-claw-<name>.stories.ts` for visual testing and interactive documentation (`npm run storybook`)
4. Import and instantiate in relevant page object
5. Expose component methods via page object (optional)
6. Document in this README

### Visual Verification with Storybook

In addition to Playwright end-to-end integration tests, ShadowClaw uses Storybook (`npm run storybook`, `npm run build:storybook`) with `@storybook/web-components-vite` to test and document UI components in isolation (e.g., toasts, dialogs, cards, empty states, page headers, provider settings, and all 18 A2UI basic catalog components in `shadow-claw-a2ui.stories.ts`). Component stories (`*.stories.ts`) verify reactive attribute reflection, custom events, inline rendering, and light/dark themes.

### Extending Fixtures

Edit `fixtures.ts`:

```js
export const test = base.extend({
  myFixture: async ({ page }, use) => {
    const instance = new MyPage(page);
    await instance.setup();
    await use(instance);
  },
});
```

### Control Plane & Stateless MCP Server Integration

ShadowClaw's Control Plane and Stateless MCP Server bridges (`POST /mcp` and `shadow-claw mcp`) connect browser tabs to external tooling and agent hosts:

- **Browser Integration:** When testing browser-side control plane handlers, `createDefaultControlPlaneClient` registers handlers for `list-tools`, `invoke-tool`, `send-message`, `read-state`, and `list-tasks`.
- **E2E Tool Execution:** The MCP server dynamic relay (`src/server/mcp/tools/client-tool-relay.ts`) invokes tools via the Control Plane, which dispatches into the browser's Web Worker (`executeTool`), accessing live OPFS workspaces and returning structured JSON-RPC responses.
- **Tool Naming Convention:** Built-in server and CLI tools are prefixed with `shadowclaw_server_` (`MCP_SERVER_TOOL_PREFIX`), while live tools relayed from connected browser clients are prefixed with `shadowclaw_client_` (`MCP_CLIENT_TOOL_PREFIX`, e.g. `shadowclaw_client_read_file`, `shadowclaw_client_list_files`), with legacy aliases supported for backward compatibility.
- **Multi-Client Targeting & Execution Guards:** Relayed tools expose a `clientId` enum parameter limited to connected clients supporting each tool. Calls route to explicit clients or the active client (`shadowclaw_server_set_active_client`), with server-side client capability validation and client-side execution guards (`allowedTools` / conversation tool tags). Interactive tools like `ask_user` support human-in-the-loop responses with extended timeouts.
- **Control Token Auto-Discovery & Retry:** CLI control clients automatically discover tokens from flags, `SHADOWCLAW_CONTROL_TOKEN`, system temporary directory (`tmpdir()`), parent directories, and SQLite, and automatically retry across remaining candidate tokens on HTTP 401 Unauthorized responses.
- **Automated Integration Tests:** End-to-end server-to-client integration tests reside in `src/server/mcp/mcp-integration.test.ts`, tool relay tests in `src/server/mcp/tools/mcp-tools.test.ts`, CLI process tests in `src/cli/cli.test.ts` and `src/cli/commands/mcp.test.ts`, and Web Share Target flow verification in `e2e/share-target.test.ts`.

## Architecture Decisions

### Why Component Objects?

- **Reusability:** `MessageInputComponent` can be used in chat, modals, etc.
- **Single Responsibility:** Each component handles one UI region
- **Testability:** Components can be tested in isolation

### Why Not Cucumber/Gherkin?

- ShadowClaw is a developer-first tool; code-based tests match the workflow
- Page objects already provide human-readable intent (e.g., `chat.sendMessage()`)
- No need for additional abstraction layer

### Why Feature-Gate Storage Tests?

- Browser APIs vary across engines (Chromium, WebKit, Firefox)
- Tests document expected behavior but gracefully skip when unsupported
- Prevents false positives in CI pipelines
