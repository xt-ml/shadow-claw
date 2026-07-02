# Guide: Adding a Channel

> Step-by-step: add a new messaging channel (e.g., Slack, webhook, CLI socket).

## When You Need This

- Connecting a new communication surface (external app, API, CLI)
- Adding a dedicated conversation channel with its own prefix and badge
- Building an integration that triggers the agent from outside the browser UI

## Prerequisite: Read the Channels doc

Make sure you understand the [`Channel` interface and `ChannelRegistry`](../subsystems/channels.md) before starting.

## Reference Implementations

ShadowClaw already includes three channel implementations:

| Channel  | Prefix | Source                      | When to use as reference     |
| -------- | ------ | --------------------------- | ---------------------------- |
| Browser  | `br:`  | `src/channels/browser-chat` | Simple in-app UI pattern     |
| Telegram | `tg:`  | `src/channels/telegram.ts`  | External service integration |
| iMessage | `im:`  | `src/channels/imessage.ts`  | Relay/bridge pattern         |

Study the implementation style that best matches your use case.

## Step 1 — Write a failing test

Create `src/channels/my-channel.test.ts`:

```ts
import { MyChannel } from "./my-channel.js";

describe("MyChannel", () => {
  let channel: MyChannel;
  let received: any[];

  beforeEach(() => {
    received = [];
    channel = new MyChannel();
    channel.onMessage((msg) => received.push(msg));
  });

  it("routes submit to onMessage callback", () => {
    channel.submit("Hello!", "my:group-1");
    expect(received).toHaveLength(1);
    expect(received[0].content).toBe("Hello!");
    expect(received[0].groupId).toBe("my:group-1");
  });

  it("calls display callback on send()", () => {
    const displayed: string[] = [];
    channel.onDisplay((groupId, text) => displayed.push(text));
    channel.send("my:group-1", "response text");
    expect(displayed).toContain("response text");
  });
});
```

## Step 2 — Implement the channel

Create `src/channels/my-channel.ts`:

```ts
import type { Channel, InboundMessage } from "../types.js";
import { ulid } from "../ulid.js";

const CHANNEL_PREFIX = "my:";

export class MyChannel implements Channel {
  readonly type = "my-channel";

  private _activeGroupId = `${CHANNEL_PREFIX}main`;
  private _messageCallbacks: Array<(msg: InboundMessage) => void> = [];
  private _displayCallbacks: Array<(groupId: string, text: string) => void> =
    [];
  private _typingCallbacks: Array<(groupId: string, typing: boolean) => void> =
    [];

  submit(text: string, groupId: string): void {
    const msg: InboundMessage = {
      id: ulid(),
      groupId,
      content: text,
      channel: this.type,
      timestamp: Date.now(),
    };
    this._messageCallbacks.forEach((cb) => cb(msg));
  }

  send(groupId: string, text: string): void {
    this._displayCallbacks.forEach((cb) => cb(groupId, text));
  }

  setTyping(groupId: string, typing: boolean): void {
    this._typingCallbacks.forEach((cb) => cb(groupId, typing));
  }

  setActiveGroup(groupId: string): void {
    this._activeGroupId = groupId;
  }

  getActiveGroup(): string {
    return this._activeGroupId;
  }

  onMessage(cb: (msg: InboundMessage) => void): void {
    this._messageCallbacks.push(cb);
  }

  onDisplay(cb: (groupId: string, text: string) => void): void {
    this._displayCallbacks.push(cb);
  }

  onTyping(cb: (groupId: string, typing: boolean) => void): void {
    this._typingCallbacks.push(cb);
  }
}
```

## Step 3 — Register in the orchestrator

Open `src/orchestrator.ts` and add your channel to `initChannels()`:

```ts
import { MyChannel } from "./channels/my-channel.js";

// In initChannels():
const myChannel = new MyChannel();
this.registry.register("my:", myChannel, "My Channel");
```

That's it — the router, conversation creation, group badges, and CRUD all pick up the new prefix automatically.

## Step 4 — Ensure a default group is created (optional)

If your channel needs a default group at startup, the orchestrator's `loadGroups()` creates it during `init()`:

```ts
// The orchestrator already handles DEFAULT_GROUP_ID for the browser channel.
// For a custom channel, you may want to seed an initial group:
await this.db.createGroup(`my:main`, "My Channel Main");
```

## Step 5 — Run the tests and type-check

```bash
npm test -- --testPathPattern my-channel
npm run tsc
```

## Tips

- **Choose a unique prefix** — prefixes must not overlap with existing ones (`br:`). The registry uses longest-prefix-first matching.
- **The badge label** (third arg to `registry.register()`) appears in conversation list badges and dialogs.
- **Full isolation** — each groupId gets its own IndexedDB message history, OPFS workspace, and scheduled tasks.
- **External triggers** — if your channel receives messages from outside the browser (webhooks, WebSocket, etc.), call `channel.submit(text, groupId)` from your listener. The orchestrator will pick it up via `onMessage`.
