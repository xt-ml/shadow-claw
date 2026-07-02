# Guide: Service Accounts & Credentials

> Manage encrypted credentials for channels, providers, and external services.

## When You Need This

- Adding a Telegram bot or iMessage bridge to ShadowClaw
- Storing API keys securely for new external services
- Setting up per-user or multi-account scenarios for channels
- Testing credential management flows

## Overview

The accounts system provides:

1. **Service Accounts** — Named, typed credential sets (encrypted at rest)
2. **Credential Storage** — IndexedDB persistence with AES-256-GCM encryption
3. **UI Integration** — Settings panels for credential input/management

## Step 1 — Define your account type

In your channel or integration code, choose a unique account type:

```ts
// Example: Telegram channel
const ACCOUNT_TYPE = "telegram";

// Example: Custom webhook service
const ACCOUNT_TYPE = "webhook-service";
```

Account types are stored as-is in the `ServiceAccount.type` field for filtering and lookup.

## Step 2 — Create a service account

When the user provides credentials (e.g., in Settings), create a new account:

```ts
import {
  createServiceAccount,
  getServiceAccount,
} from "../accounts/service-accounts.js";

// Create
const account = await createServiceAccount(
  "My Telegram Bot", // Display name
  "telegram", // Account type
  { bot_token: "123456:ABCxyz..." }, // Credentials
);

// The returned account has:
// - id (ULID)
// - name, type, credentials
// - createdAt, updatedAt timestamps
// - credentials are encrypted at rest in IndexedDB
```

## Step 3 — Retrieve and use credentials

When your channel or integration needs to use credentials:

```ts
// Get by ID
const account = await getServiceAccount(accountId);
if (!account) {
  throw new Error("Account not found");
}

// Credentials are automatically decrypted on read
const botToken = account.credentials.bot_token;
const response = await fetch(
  "https://api.telegram.org/bot" + botToken + "/getMe",
);
```

## Step 4 — List accounts (optional filtering)

Retrieve all accounts, optionally filtered by type:

```ts
import { listServiceAccounts } from "../accounts/service-accounts.js";

// All accounts
const all = await listServiceAccounts();

// Filtered by type
const telegramAccounts = await listServiceAccounts("telegram");
```

## Step 5 — Update credentials

Modify an existing account (e.g., when user changes their bot token):

```ts
import { updateServiceAccount } from "../accounts/service-accounts.js";

await updateServiceAccount(accountId, {
  credentials: {
    bot_token: "new_token_here",
  },
});
```

## Step 6 — Delete an account

Remove an account when no longer needed:

```ts
import { deleteServiceAccount } from "../accounts/service-accounts.js";

await deleteServiceAccount(accountId);
```

## Integration Pattern: Channel + Settings UI

### Settings UI Panel

Create a settings component (e.g., `<shadow-claw-settings-telegram>`):

```ts
// When user pastes a bot token and clicks "Save"
const account = await createServiceAccount("My Bot", "telegram", {
  bot_token: inputValue,
});

// Validate credentials (optional but recommended)
const response = await fetch(`https://api.telegram.org/bot${inputValue}/getMe`);
if (!response.ok) {
  throw new Error("Invalid bot token");
}

// Store the account ID in config for later retrieval
await setConfig(CONFIG_KEYS.TELEGRAM_ACCOUNT_ID, account.id);

// Display success toast
showToast("Telegram bot connected");
```

### Channel Runtime

When the channel needs to send a message:

```ts
// In TelegramChannel.send():
const accountId = await getConfig(CONFIG_KEYS.TELEGRAM_ACCOUNT_ID);
if (!accountId) {
  throw new Error("No Telegram account configured");
}

const account = await getServiceAccount(accountId);
const botToken = account.credentials.bot_token;

// Use botToken to call Telegram API
```

## Credential Scoping

Different integrations may use different credential schemes:

### Provider Credentials

| Provider                     | Key Name  | Type   | Usage                       |
| ---------------------------- | --------- | ------ | --------------------------- |
| `openrouter`                 | `api_key` | string | Bearer token                |
| `github_models`              | `api_key` | string | GitHub token (proxy)        |
| `copilot_azure_openai_proxy` | `api_key` | string | Azure OpenAI-compatible key |

### Channel Credentials

| Channel  | Key Names                             | Type   | Usage                          |
| -------- | ------------------------------------- | ------ | ------------------------------ |
| Telegram | `bot_token`                           | string | Telegram Bot API token         |
| iMessage | `bridge_url`, `api_key`, `auth_token` | string | Bridge endpoint + auth headers |

For new integrations, define credentials clearly:

```ts
interface MyServiceCredentials {
  api_endpoint: string;
  api_key: string;
  webhook_secret?: string; // Optional
}
```

## Encryption & Security

All credentials are encrypted using `src/crypto.ts`:

```ts
// Encryption (automatic in storage layer)
const encrypted = await encryptString(plaintext, cryptoKey);

// Decryption (automatic on read)
const plaintext = await decryptString(encrypted, cryptoKey);
```

**Best practices:**

- **Never log credentials** — only decrypt in trusted contexts (channel init, API calls)
- **Validate immediately** — test credentials (e.g., API ping) before persisting
- **Minimize scope** — grant only the minimum permissions needed for each service
- **Rotate regularly** — encourage users to refresh tokens periodically
- **Handle errors gracefully** — if a credential is invalid, show a clear error and prompt for re-entry

## Testing Credentials

When writing tests for credential-dependent code, mock the accounts layer:

```ts
import { jest } from "@jest/globals";
jest.unstable_mockModule("../accounts/service-accounts.js", () => ({
  getServiceAccount: jest.fn(async (id) => ({
    id,
    name: "Test Account",
    type: "telegram",
    credentials: { bot_token: "test_token_123" },
  })),
}));
```

Then import and use normally:

```ts
const { getServiceAccount } = await import("../accounts/service-accounts.js");
const account = await getServiceAccount("test-id");
```

## Troubleshooting

### Credentials not persisting

- Check that `setConfig()` / `updateServiceAccount()` completed without error
- Verify IndexedDB is not quota-limited (`navigator.storage.estimate()`)
- Check browser console for crypto errors

### Decryption fails

- Verify the cryptographic key hasn't changed (usually session-scoped)
- Check that the account ID is correct (`getServiceAccount()` returns `undefined` if not found)
- Confirm the encrypted value is being read from the correct IndexedDB store

### Settings UI doesn't show accounts

- Ensure `listServiceAccounts(type)` is being called with the correct type filter
- Check that components are re-rendering when accounts change (use Signals/`effect()`)
- Verify Settings permissions / capabilities

## Next Steps

- See [Accounts & Credentials](../subsystems/accounts.md) for implementation details
- See [Adding a Channel](adding-a-channel.md) for channel integration patterns
- See [Adding a Provider](adding-a-provider.md) for provider credential scoping
