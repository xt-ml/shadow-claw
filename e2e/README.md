# ShadowClaw E2E Test Architecture

Professional end-to-end test suite for ShadowClaw using Playwright with the Page Object Model pattern.

## Architecture Overview

```text
e2e/
├── components/          # Reusable component objects for UI regions
│   ├── nav.component.ts
│   ├── message-input.component.ts
│   ├── chat-actions.component.ts
│   ├── file-browser.component.ts
│   └── conversations.component.ts
├── pages/              # Page objects representing app views
│   ├── app.page.ts    # Root app + navigation
│   ├── chat.page.ts   # Chat interface
│   ├── files.page.ts  # Files browser
│   ├── tasks.page.ts  # Task scheduler
│   └── settings.page.ts  # Settings panel
├── shared/             # Low-level utilities and helpers
│   └── index.ts       # DB helpers, constants, wait functions
├── fixtures.ts        # Shared test fixtures (app, chat, files, tasks, settings, conversations)
├── *.test.ts          # Test suites
│   └── conversations.test.ts  # Conversation CRUD (create, rename, switch, delete)
│   └── settings.test.ts       # Settings persistence (max iterations, streaming, assistant name)
│   └── streaming-chat.test.ts # Chat flow with mock SSE streaming + non-streaming
│   └── task-crud.test.ts       # Task CRUD (create, edit, toggle, delete)
│   └── file-viewer.test.ts    # File viewer component integration coverage
│   └── share-target.test.ts   # Web Share Target import flow (pending share queue → file save → conversation switch)
│   └── orchestrator.test.ts / storage.test.ts  # System integration coverage
└── README.md           # This file
```

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

Tests should **not** contain `page.evaluate()` blocks for DOM queries. Instead:

- ✅ Use page object methods: `chat.messageCount()`
- ✅ Use component locators: `chat.messages()`
- ❌ Avoid: `page.evaluate(() => document.querySelector(...))`

**Exception:** Low-level browser API checks (IndexedDB, OPFS) in `storage.test.ts` are acceptable.

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

Manages chat message input and send button.

**Methods:**

- `fill(text)` — Type into textarea
- `send()` — Click send button
- `fillAndSend(text)` — Combined fill + send
- `placeholder()` — Get placeholder text
- `expectVisible()` — Assert textarea and button are visible
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
- `Host -> VM` and `VM -> Host` sync buttons are mode-gated; they render only when VM mode is `9p`.

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
- `chatComponent()`, `filesComponent()`, `tasksComponent()`, `toastComponent()` — Component locators

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
- **Transformers.js Testing**: Verify model download progress, local inference, and chat-template sanitization when using local models.
- **Provider Help Dialogs**: When a provider request fails, the application may display a contextual help dialog. Use `app.navigateToWithOpenDialog()` to test flows that interrupt navigation with dialogs, or verify dialog content via standard locators on the `.app-dialog` component.
- **Attachment Capabilities**: When testing file attachments, keep in mind that the application dynamically selects native vs. fallback delivery based on model capabilities (`src/attachment-capabilities.ts`).

### `FilesPage`

File browser controller.

**Properties:**

- `browser` — `FileBrowserComponent`

**Methods:**

- `open()` — Navigate to files page
- `fileList()`, `uploadButton()`, `breadcrumbs()` — Delegate to browser component

### `TasksPage`

Task scheduler controller.

**Methods:**

- `open()` — Navigate to tasks page
- `allButtons()`, `textInputs()`, `toggles()` — Locator helpers
- `taskLikeElements()` — Query task-related DOM nodes

### `SettingsPage`

Settings panel controller.

**Methods:**

- `open()` — Navigate to settings page
- `llm()` — LLM settings sub-component locator
- `maxIterationsInput()` — Max iterations number input
- `saveMaxIterationsButton()` — Save max iterations button
- `streamingToggle()` — Streaming toggle checkbox
- `providerSelect()` — Provider select dropdown
- `modelSelect()` — Model select dropdown
- `apiKeyInput()` — API key input
- `saveApiKeyButton()` — Save API key button
- `assistantNameInput()` — Assistant name input
- `saveAssistantNameButton()` — Save assistant name button

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
- WebMCP integration depends on `navigator.modelContext` support.
- In unsupported browsers, tests should verify graceful fallback/error messaging,
  not hard-fail on unavailable platform features.

## Storage Tests (Feature-Gated)

Storage integration tests (`storage.test.ts`) are **feature-gated** at runtime:

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

1. Create component in `src/components/shadow-claw-<name>/shadow-claw-<name>.ts`
2. Import and instantiate in relevant page object
3. Expose component methods via page object (optional)
4. Document in this README

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
