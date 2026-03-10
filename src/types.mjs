/**
 * @typedef {Object} InboundMessage
 *
 * @property {string} id
 * @property {string} groupId - e.g., "br:main"
 * @property {string} sender
 * @property {string} content
 * @property {number} timestamp - epoch ms
 * @property {ChannelType} channel
 */

/**
 * @typedef {Object} StoredMessage
 *
 * @property {string} id
 * @property {string} groupId
 * @property {string} sender
 * @property {string} content
 * @property {number} timestamp
 * @property {ChannelType} channel
 * @property {boolean} isFromMe
 * @property {boolean} isTrigger
 */

/**
 * @typedef {Object} Task
 *
 * @property {string} id
 * @property {string} groupId
 * @property {string} schedule - cron expression
 * @property {string} prompt
 * @property {boolean} isScript
 * @property {boolean} enabled
 * @property {number|null} lastRun
 * @property {number} createdAt
 */

/**
 * @typedef {Object} Session
 *
 * @property {string} groupId
 * @property {ConversationMessage[]} messages
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} ConversationMessage
 *
 * @property {'user'|'assistant'} role
 * @property {string|ContentBlock[]} content
 */

/**
 * @typedef {Object} TextContent
 *
 * @property {'text'} type
 * @property {string} text
 */

/**
 * @typedef {Object} ToolUseContent
 *
 * @property {'tool_use'} type
 * @property {string} id
 * @property {string} name
 * @property {Record<string, any>} input
 */

/**
 * @typedef {Object} ToolResultContent
 *
 * @property {'tool_result'} type
 * @property {string} tool_use_id
 * @property {string} content
 */

/**
 * @typedef {TextContent|ToolUseContent|ToolResultContent} ContentBlock
 */

/**
 * @typedef {Object} ConfigEntry
 *
 * @property {string} key
 * @property {string} value - JSON-encoded or raw string
 */

/**
 * @typedef {'browser'} ChannelType
 */

/**
 * @typedef {Object} Channel
 *
 * @property {ChannelType} type
 * @property {Function} start
 * @property {Function} stop
 * @property {Function} send
 * @property {Function} setTyping
 * @property {Function} onMessage
 */

/**
 * @typedef {Object} InvokePayload
 *
 * @property {string} groupId
 * @property {ConversationMessage[]} messages
 * @property {string} systemPrompt
 * @property {string} apiKey
 * @property {string} model
 * @property {number} maxTokens
 */

/**
 * @typedef {Object} CompactPayload
 *
 * @property {string} groupId
 * @property {ConversationMessage[]} messages
 * @property {string} systemPrompt
 * @property {string} apiKey
 * @property {string} model
 * @property {number} maxTokens
 */

/**
 * @typedef {Object} ResponsePayload
 *
 * @property {string} groupId
 * @property {string} text
 */

/**
 * @typedef {Object} ErrorPayload
 *
 * @property {string} groupId
 * @property {string} error
 */

/**
 * @typedef {Object} TypingPayload
 *
 * @property {string} groupId
 */

/**
 * @typedef {Object} ToolActivityPayload
 *
 * @property {string} groupId
 * @property {string} tool
 * @property {string} status
 */

/**
 * @typedef {Object} ThinkingLogEntry
 *
 * @property {string} groupId
 * @property {string} level - 'info' | 'api-call' | 'tool' | 'error'
 * @property {string} label
 * @property {string} message
 * @property {number} timestamp
 */

/**
 * @typedef {Object} TokenUsage
 *
 * @property {string} groupId
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {Object} ToolActivity
 *
 * @property {string} tool
 * @property {string} status
 */

/**
 * @typedef {Object} CompactDonePayload
 *
 * @property {string} groupId
 * @property {string} summary
 */

/**
 * @typedef {Object} OpenFilePayload
 *
 * @property {string} groupId
 * @property {string} path
 */

/**
 * @typedef {Object} LLMProvider
 *
 * @property {string} id
 * @property {string} name
 * @property {string[]} [models]
 */

/**
 * @typedef {
 *   | { type: 'response'; payload: ResponsePayload }
 *   | { type: 'error'; payload: ErrorPayload }
 *   | { type: 'typing'; payload: TypingPayload }
 *   | { type: 'tool-activity'; payload: ToolActivityPayload }
 *   | { type: 'thinking-log'; payload: ThinkingLogEntry }
 *   | { type: 'compact-done'; payload: CompactDonePayload }
 *   | { type: 'open-file'; payload: OpenFilePayload }
 * } WorkerOutbound
 */

/**
 * @typedef {
 *   | { type: 'invoke'; payload: InvokePayload }
 *   | { type: 'cancel'; payload: { groupId: string } }
 *   | { type: 'compact'; payload: CompactPayload }
 * } WorkerInbound
 */

export {};
