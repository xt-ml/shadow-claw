# Accounts & Credentials

> Service account management and credential storage for multi-channel and provider authentication.

**Source:** `src/accounts/service-accounts.ts` · `src/accounts/stored-credentials.ts`

## Overview

The accounts subsystem provides:

1. **Service Accounts** — Named credentials (API keys, tokens, auth headers) organized by provider/service
2. **Credential Storage** — Encrypted storage via `src/crypto.ts` (AES-256-GCM)
3. **Multi-Channel Auth** — Support for Telegram bot tokens, iMessage bridge keys, and provider-specific credentials

## Service Accounts

**File:** `src/accounts/service-accounts.ts`

Service accounts are named sets of credentials for external services:

```ts
interface ServiceAccount {
  id: string; // Unique identifier
  name: string; // Display name (e.g., "My Telegram Bot")
  type: string; // "telegram" | "imessage" | "provider" | custom
  credentials: Record<string, string>; // Key-value pairs (encrypted at rest)
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}
```

**Operations:**

| Method                                    | Purpose                                   |
| ----------------------------------------- | ----------------------------------------- |
| `createServiceAccount(name, type, creds)` | Create and persist a new account          |
| `getServiceAccount(id)`                   | Retrieve account by ID (decrypted)        |
| `listServiceAccounts(type?)`              | List all accounts, optionally filtered    |
| `updateServiceAccount(id, updates)`       | Update account credentials                |
| `deleteServiceAccount(id)`                | Delete account and associated credentials |

## Stored Credentials

**File:** `src/accounts/stored-credentials.ts`

Low-level credential storage layer with IndexedDB persistence:

- Credentials are encrypted before writing to IndexedDB
- Decrypted on read using the crypto vault key
- Supports bulk operations for efficient batch queries

## Channel Credential Flows

### Telegram

- **Account type:** `"telegram"`
- **Stored credential:** `bot_token`
- **Usage:** Telegram channel reads from service account at invocation time
- **Settings UI:** Paste bot token → create/update account → stored encrypted

### iMessage

- **Account type:** `"imessage"`
- **Stored credentials:** `bridge_url`, `api_key` (optional), `auth_token`
- **Usage:** iMessage channel uses account credentials to authenticate with bridge service
- **Settings UI:** Enter bridge endpoint + API key → create/update account → stored encrypted

### LLM Providers

- **Account type:** `"provider"` (mapped per provider)
- **Stored credential:** `api_key`
- **Usage:** Provider authentication at invocation time
- **Settings UI:** Select provider → paste API key → update account

## Encryption

All credentials are encrypted at rest using `src/crypto.ts`:

```ts
// Encryption
const encrypted = await encryptString(plaintext, cryptoKey);

// Decryption
const decrypted = await decryptString(encrypted, cryptoKey);
```

The crypto key is derived from browser storage (IndexedDB, OPFS, or session state) and is never persisted to disk.

## Settings Integration

The **Settings UI** provides panels for managing service accounts:

- `<shadow-claw-channel-config>` — Telegram/iMessage account setup
- `<shadow-claw-llm>` — Provider API key management
- `<shadow-claw-accounts>` — General account CRUD (future)

## Best Practices

- **Never log credentials** — credentials are only decrypted in trusted contexts (orchestrator, channel init)
- **Minimize credential scope** — only grant the minimum permissions needed for each service
- **Rotate regularly** — encourage users to rotate bot tokens and API keys periodically
- **Validate before storing** — test credentials (e.g., ping Telegram Bot API) before persisting
