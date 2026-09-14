/**
 * parseLocalModelToolCall
 *
 * Shared utility that converts the raw text output of a locally-running ONNX
 * model into a structured tool-call object.  Both the Express-based
 * Transformers.js HTTP proxy route (`src/server/routes/transformers-js.ts`)
 * and the headless in-process Node executor
 * (`src/worker/tools/node-transformers-executor.ts`) use this function so that
 * tool-call parsing is always identical regardless of the runtime (browser ↔
 * headless CLI).
 *
 * Supported model output grammars
 * ─────────────────────────────────
 * 1. Gemma 4 native  — `call:<name>{key:<|"|>value<|"|>,...}` (after special-
 *    token stripping the `<|tool_call>` prefix becomes invisible).
 * 2. Generic "legacy" — `call: <name> { key: value, ... }`
 * 3. execute_tool tag — `<execute_tool> name(key=value) </execute_tool>`
 * 4. Qwen [tool_code] — `[tool_code]\n<name>({ "key": "value" })\n[/tool_code]`
 *    (already handled by the existing `normalizeToolCodeResponses` path in
 *    handleInvoke.ts; included here so the executor can also detect it).
 */

export interface ParsedToolCall {
  name: string;
  input: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Internal argument parsers
// ---------------------------------------------------------------------------

/**
 * Loose key:value or key=value argument parser.
 * Handles unquoted values, single/double-quoted strings, booleans, and numbers.
 */
function parseLooseKVArgs(raw: string): Record<string, any> {
  const body = raw.trim();
  if (!body) return {};

  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let depth = 0;

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if ((ch === '"' || ch === "'") && body[i - 1] !== "\\") {
      if (quote === ch) quote = null;
      else if (!quote) quote = ch;
      current += ch;
      continue;
    }
    if (!quote) {
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if ((ch === ")" || ch === "}" || ch === "]") && depth > 0) depth--;
      else if (ch === "," && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  const result: Record<string, any> = {};
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    const colonIdx = part.indexOf(":");
    const eqIdx = part.indexOf("=");
    const idx =
      colonIdx > 0 && (eqIdx <= 0 || colonIdx <= eqIdx) ? colonIdx : eqIdx;
    if (idx <= 0) continue;
    const key = part
      .slice(0, idx)
      .trim()
      .replace(/^['"<|"|\>]|['"<|"|\>]$/g, "")
      .trim();
    let val = part.slice(idx + 1).trim();
    if (!key) continue;

    // Gemma uses <|"|> as a quote delimiter — strip it
    val = val.replace(/^\s*<\|"\|\>\s*/, "").replace(/\s*<\|"\|\>\s*$/, "");

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      result[key] = val.slice(1, -1).replace(/\\(["'\\])/g, "$1");
      continue;
    }
    if (val === "true") {
      result[key] = true;
      continue;
    }
    if (val === "false") {
      result[key] = false;
      continue;
    }
    if (val === "null") {
      result[key] = null;
      continue;
    }
    const num = Number(val);
    if (!Number.isNaN(num) && val !== "") {
      result[key] = num;
      continue;
    }
    result[key] = val;
  }
  return result;
}

/**
 * Try to parse a JSON object string.  Falls back to `parseLooseKVArgs` with
 * the outer `{…}` stripped so the KV parser sees only `key:value` pairs.
 */
function parseArgsBody(raw: string): Record<string, any> {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // fall through to loose parser — strip braces first
    }
    // Peel off the { } wrapper so the KV parser sees `key:value,...`
    return parseLooseKVArgs(trimmed.slice(1, -1));
  }
  return parseLooseKVArgs(trimmed);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw model text for a tool-call invocation.
 *
 * Returns `null` if no tool call is detected.
 */
export function parseLocalModelToolCall(text: string): ParsedToolCall | null {
  // Strip common end-of-turn special tokens left in by some models
  const trimmed = text
    .replace(/<\s*turn\|>\s*|<\|end_of_turn\|>|<\|eot_id\|>/gi, "")
    .replace(/<\|tool_call\|?>/gi, "") // Gemma 4 <|tool_call>
    .trim();

  if (!trimmed) return null;

  // ── 1. Gemma "call:" syntax ─────────────────────────────────────────────
  // Pattern: `call:<name>{...}` or `call: <name> {...}`
  const callMatch = trimmed.match(
    /^call\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([\s\S]*)\}\s*$/,
  );
  if (callMatch?.[1]) {
    return {
      name: callMatch[1],
      input: parseArgsBody(`{${callMatch[2]}}`),
    };
  }

  // ── 2. <execute_tool> syntax ─────────────────────────────────────────────
  // Pattern: `<execute_tool> name(args) </execute_tool>`
  const execMatch = trimmed.match(
    /^<\s*execute_tool\s*>\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*<\s*\/\s*execute_tool\s*>\s*$/i,
  );
  if (execMatch?.[1]) {
    return {
      name: execMatch[1],
      input: parseLooseKVArgs(execMatch[2] ?? ""),
    };
  }

  // ── 3. Qwen [tool_code] syntax ───────────────────────────────────────────
  // Pattern: `[tool_code]\nprint(name({...}))\n[/tool_code]`
  //       or `[tool_code]\nname({...})\n[/tool_code]`
  const toolCodeMatch = trimmed.match(
    /^\[tool_code\]([\s\S]*?)\[\/tool_code\]$/i,
  );
  if (toolCodeMatch?.[1]) {
    const body = toolCodeMatch[1].trim();
    // print(name({...})) or name({...})
    const printMatch = body.match(
      /^print\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)\s*\)$/s,
    );
    const directMatch = body.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)$/s,
    );
    const m = printMatch ?? directMatch;
    if (m?.[1]) {
      const rawArgs = (m[2] ?? "").trim();
      if (!rawArgs.startsWith("{") || !rawArgs.endsWith("}")) return null;
      try {
        const input = JSON.parse(rawArgs);
        if (input && typeof input === "object" && !Array.isArray(input)) {
          return { name: m[1], input: input as Record<string, any> };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Convert ShadowClaw's internal tool definitions to the OpenAI function-
 * calling schema format that chat templates and LLM APIs expect.
 *
 * Internal format: `{ name: string; description: string; input_schema: object }`
 * OpenAI format:   `{ type: "function"; function: { name; description; parameters } }`
 */
export function convertToolSchemasToOpenAI(tools: any[]): any[] {
  if (!Array.isArray(tools) || tools.length === 0) return [];
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema ?? {},
    },
  }));
}
