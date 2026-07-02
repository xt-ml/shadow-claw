# Configuring Messaging Channels

> Step-by-step setup guides for Telegram and iMessage channel integration in ShadowClaw.

**Settings:** Open Settings → Messaging Channels to configure any of these options.

## Overview

ShadowClaw supports three messaging channels:

- **Browser Chat** (`br:`) — In-app chat interface (always available)
- **Telegram** (`tg:`) — Telegram Bot API integration
- **iMessage** (`im:`) — iMessage bridge via HTTP relay

Each channel maps to a conversation group with a unique prefix. You can have multiple independent conversations across different channels simultaneously.

**Architecture:** See [docs/subsystems/channels.md](../subsystems/channels.md) for technical details on the channel registry and plugin architecture.

## Telegram Setup

### Telegram Prerequisites

1. A Telegram account
2. Bot token from `@BotFather`
3. Chat IDs you want to authorize

### Telegram Step-by-Step

1. **Create a Bot**
   - Message `@BotFather` on Telegram
   - Send `/newbot`
   - Follow the prompts (name, username, etc.)
   - BotFather returns your **bot token**

2. **Configure ShadowClaw**
   - Open Settings → Messaging Channels
   - Find the "Telegram Bot Token" field
   - Paste your bot token and save

3. **Authorize Chat Conversations**
   - Send `/chatid` to your bot from **each chat/group** you want to use
   - The bot responds with the chat ID
   - Copy the chat ID

4. **Whitelist Chat IDs**
   - In Settings → Messaging Channels, find "Telegram Allowed Chat IDs"
   - Paste all chat IDs (comma-separated or one per line)
   - Save

### How It Works

- **Auto-trigger**: Messages from authorized chats automatically invoke the agent
- **Mention-optional**: You don't need to mention the bot (unlike many Telegram bots)
- **Built-in commands**: `/chatid` and `/ping` work even before whitelisting
- **API method**: Integration uses the Telegram Bot API directly from the browser (HTTPS)

### Example

```
You: "Hey bot, what's 2+2?"
Bot processes → @ShadowClaw agent → Result: "4"
Bot replies: "4"
```

## iMessage Setup

### Prerequisites

1. An iMessage bridge HTTP service (you need to host this or have access to one)
2. Bridge base URL
3. Optional: API key if the bridge requires authentication
4. Chat IDs you want to authorize

### iMessage Step-by-Step

1. **Obtain Bridge URL**
   - Ask your bridge provider for the base URL
   - Should be something like `https://imessage-bridge.example.com`

2. **Configure ShadowClaw**
   - Open Settings → Messaging Channels
   - Find "iMessage Bridge URL"
   - Paste the bridge URL and save

3. **Add API Key (if required)**
   - In Settings → Messaging Channels, find "iMessage Bridge API Key"
   - If your bridge requires authentication, paste the API key here
   - Save

4. **Authorize Conversations**
   - Ask your bridge provider for chat IDs of conversations you want to use
   - In Settings → Messaging Channels, find "iMessage Allowed Chat IDs"
   - Paste chat IDs (comma-separated)
   - Save

### Bridge Contract

Your bridge service must expose these endpoints:

| Endpoint           | Method | Purpose                    |
| ------------------ | ------ | -------------------------- |
| `/messages`        | GET    | Poll for new messages      |
| `/messages/send`   | POST   | Send a response message    |
| `/messages/typing` | POST   | Show/hide typing indicator |

#### GET `/messages?cursor=...&timeout=...`

Returns recent messages since a cursor position.

**Response:**

```json
{
  "messages": [
    {
      "id": "msg-1234",
      "guid": "unique-identifier",
      "chatId": "group-123",
      "sender": { "name": "Alice", "id": "user-123" },
      "text": "Hello!",
      "timestamp": 1234567890
    }
  ],
  "nextCursor": "cursor-567"
}
```

#### POST `/messages/send`

Send a message to a chat.

**Request:**

```json
{
  "chatId": "group-123",
  "text": "Response text"
}
```

#### POST `/messages/typing`

Update typing status.

**Request:**

```json
{
  "chatId": "group-123",
  "typing": true
}
```

### Authentication

If your bridge requires authentication, ShadowClaw will send:

- `Authorization: Bearer <api-key>` (if API key is configured)
- `X-API-Key: <api-key>` (also sent for compatibility)

### Example Bridge Implementation

A minimal Python Flask example:

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

# In-memory message queue (use persistent storage in production)
message_queue = []
cursor_position = 0

@app.route('/messages', methods=['GET'])
def get_messages():
    cursor = request.args.get('cursor', '0')
    timeout = request.args.get('timeout', '30')

    # Return messages since cursor
    # Implement long-polling or real-time push here
    return jsonify({
        'messages': message_queue,
        'nextCursor': str(len(message_queue))
    })

@app.route('/messages/send', methods=['POST'])
def send_message():
    data = request.json
    chat_id = data.get('chatId')
    text = data.get('text')

    # Send via iMessage (use a real iMessage library)
    # This is pseudo-code
    send_imessage(chat_id, text)

    return jsonify({'ok': True})

@app.route('/messages/typing', methods=['POST'])
def set_typing():
    data = request.json
    chat_id = data.get('chatId')
    typing = data.get('typing', False)

    # Update typing indicator
    update_typing_indicator(chat_id, typing)

    return jsonify({'ok': True})

if __name__ == '__main__':
    app.run(port=5000)
```

## Managing Channel Conversations

### Creating a Conversation

When you create a new conversation in ShadowClaw:

1. Open the conversation sidebar
2. Click the **+** (Create) button
3. Choose the channel (Browser, Telegram, iMessage)
4. If Telegram/iMessage: select the chat ID
5. Name the conversation and save

The conversation ID is auto-prefixed (`br:`, `tg:`, `im:`) so you can track which channel it belongs to.

### Switching Between Channels

All active conversations appear in the sidebar. Click any conversation to switch to it. State is fully isolated per conversation.

### Auto-Trigger vs. Manual

| Channel  | Auto-trigger | Mention required? |
| -------- | ------------ | ----------------- |
| Browser  | Manual only  | N/A (click send)  |
| Telegram | Yes          | No                |
| iMessage | Yes          | No                |

For Telegram/iMessage, agent invocation happens automatically when a message arrives. Browser channel requires you to explicitly send a message.

## Troubleshooting

### Telegram

**Bot doesn't respond:**

- Check bot token is valid (paste in Settings again)
- Verify chat ID is correct (`/chatid` output)
- Ensure chat ID is in the whitelist

**`/chatid` doesn't work:**

- Restart the bot: `/start`
- Check internet connectivity from your device
- Verify bot hasn't been blocked by Telegram

**Messages arrive very slowly:**

- Telegram Bot API has polling delays (Telegram's limitation, not ShadowClaw's)
- Consider webhook-based polling if you need real-time

### iMessage

**Bridge connection fails:**

- Check bridge URL is correct and accessible
- Verify CORS headers allow requests from ShadowClaw origin
- Test bridge manually: `curl https://bridge.url/messages`

**Messages don't sync:**

- Verify bridge `/messages` endpoint returns valid JSON
- Check chat IDs match what the bridge expects
- Review bridge logs for errors

**Typing indicator doesn't work:**

- Ensure bridge implements `/messages/typing` endpoint
- Check API key (if required) is correct

## Channel Architecture

For developers interested in adding new channels or understanding the plugin system, see [docs/subsystems/channels.md](../subsystems/channels.md) and [docs/guides/adding-a-channel.md](../guides/adding-a-channel.md).
