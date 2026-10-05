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

/**
 * Extract balanced curly-brace substring `{ ... }` starting from startIndex.
 * Respects single and double quotes and escaped characters.
 */
function extractBalancedBraces(
  text: string,
  startIndex: number,
): { body: string; endIndex: number } | null {
  const openIdx = text.indexOf("{", startIndex);
  if (openIdx === -1) return null;

  let depth = 0;
  let quote: '"' | "'" | null = null;

  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if ((ch === '"' || ch === "'") && text[i - 1] !== "\\") {
      if (quote === ch) {
        quote = null;
      } else if (!quote) {
        quote = ch;
      }
      continue;
    }
    if (!quote) {
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return {
            body: text.slice(openIdx, i + 1),
            endIndex: i + 1,
          };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse raw model text for ALL tool-call invocations.
 *
 * Supports:
 * - Gemma 4 `call:<name>{...}` syntax (single or multiple)
 * - Standard `<tool_call>\n{"name": "...", "arguments": {...}}\n</tool_call>`
 * - `<execute_tool> name(...) </execute_tool>` syntax
 * - Qwen `[tool_code] ... [/tool_code]` syntax
 *
 * Automatically strips thought channel tokens (`<|channel>thought...<channel|>`),
 * `<think>...</think>` tags, and Gemma 4 `<tool_call|>` closing tokens.
 */
export function parseLocalModelToolCalls(text: string): ParsedToolCall[] {
  if (!text || typeof text !== "string") return [];

  // 1. Strip thought channels / thinking tags
  const cleaned = text
    .replace(/<\|channel\>[\s\S]*?<channel\|>/gi, "")
    .replace(/<think\>[\s\S]*?<\/think>/gi, "")
    .replace(/<\s*turn\|>\s*|<\|end_of_turn\|>|<\|eot_id\|>|<\|im_end\|>/gi, "")
    .replace(/<\|tool_call\|?>|<tool_call\|>/gi, "")
    .trim();

  if (!cleaned) return [];

  const calls: ParsedToolCall[] = [];

  // ── 1. Standard <tool_call> JSON format ─────────────────────────────────
  const toolCallXmlMatches = cleaned.matchAll(
    /<\s*tool_call\s*>([\s\S]*?)<\s*\/\s*tool_call\s*>/gi,
  );
  for (const m of toolCallXmlMatches) {
    const inner = (m[1] ?? "").trim();
    if (!inner) continue;
    if (inner.startsWith("{") && inner.endsWith("}")) {
      try {
        const parsed = JSON.parse(inner);
        if (parsed && typeof parsed.name === "string") {
          calls.push({
            name: parsed.name,
            input:
              parsed.arguments && typeof parsed.arguments === "object"
                ? parsed.arguments
                : {},
          });
        }
      } catch {
        // Fall through
      }
    }
  }

  // ── 2. <execute_tool> syntax ─────────────────────────────────────────────
  const execToolMatches = cleaned.matchAll(
    /<\s*execute_tool\s*>([\s\S]*?)<\s*\/\s*execute_tool\s*>/gi,
  );
  for (const m of execToolMatches) {
    const inner = (m[1] ?? "").trim();
    const execMatch = inner.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/i);
    if (execMatch?.[1]) {
      calls.push({
        name: execMatch[1],
        input: parseLooseKVArgs(execMatch[2] ?? ""),
      });
    }
  }

  // ── 3. Qwen [tool_code] syntax ───────────────────────────────────────────
  const toolCodeMatches = cleaned.matchAll(
    /\[tool_code\]([\s\S]*?)\[\/tool_code\]/gi,
  );
  for (const m of toolCodeMatches) {
    const body = (m[1] ?? "").trim();
    const printMatch = body.match(
      /^print\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)\s*\)$/s,
    );
    const directMatch = body.match(
      /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*(.*?)\s*\)$/s,
    );
    const mFn = printMatch ?? directMatch;
    if (mFn?.[1]) {
      const rawArgs = (mFn[2] ?? "").trim();
      if (rawArgs.startsWith("{") && rawArgs.endsWith("}")) {
        try {
          const input = JSON.parse(rawArgs);
          if (input && typeof input === "object" && !Array.isArray(input)) {
            calls.push({ name: mFn[1], input });
          }
        } catch {
          // Fall through
        }
      }
    }
  }

  // ── 4. Gemma 4 "call:" syntax (balanced brace extraction) ─────────────────
  // Matches `call:name{` anywhere in the text without greedy argument mangling
  const callRegex =
    /(?:^|[^a-zA-Z0-9_])call\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\{)/g;
  let match: RegExpExecArray | null;
  while ((match = callRegex.exec(cleaned)) !== null) {
    const toolName = match[1]!;
    const openBraceIdx = match.index + match[0].length - 1;
    const balanced = extractBalancedBraces(cleaned, openBraceIdx);
    if (balanced) {
      calls.push({
        name: toolName,
        input: parseArgsBody(balanced.body),
      });
      callRegex.lastIndex = balanced.endIndex;
    }
  }

  return calls;
}

/**
 * Parse raw model text for a tool-call invocation.
 * Returns the first detected tool call, or `null` if none detected.
 */
export function parseLocalModelToolCall(text: string): ParsedToolCall | null {
  const calls = parseLocalModelToolCalls(text);
  return calls[0] ?? null;
}

function sanitizePropertySchema(val: any): Record<string, any> {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    return { type: "string" };
  }

  const prop: Record<string, any> = { ...val };

  // Infer missing type
  if (!prop.type) {
    if (Array.isArray(prop.anyOf) && prop.anyOf.length > 0) {
      const match = prop.anyOf.find(
        (x: any) => x && typeof x.type === "string",
      );
      prop.type = match ? match.type : "string";
    } else if (Array.isArray(prop.oneOf) && prop.oneOf.length > 0) {
      const match = prop.oneOf.find(
        (x: any) => x && typeof x.type === "string",
      );
      prop.type = match ? match.type : "string";
    } else if (prop.properties && typeof prop.properties === "object") {
      prop.type = "object";
    } else if (prop.items && typeof prop.items === "object") {
      prop.type = "array";
    } else {
      prop.type = "string";
    }
  }

  if (prop.type === "object") {
    const childProps = prop.properties;
    const sanitizedChildProps: Record<string, any> = {};
    if (
      childProps &&
      typeof childProps === "object" &&
      !Array.isArray(childProps)
    ) {
      for (const [k, v] of Object.entries(childProps)) {
        sanitizedChildProps[k] = sanitizePropertySchema(v);
      }
    }
    prop.properties = sanitizedChildProps;
  } else if (prop.type === "array") {
    if (
      prop.items &&
      typeof prop.items === "object" &&
      !Array.isArray(prop.items)
    ) {
      prop.items = sanitizePropertySchema(prop.items);
    } else {
      prop.items = { type: "string" };
    }
  }

  return prop;
}

/**
 * Defensively sanitize parameter schemas so that strict chat templates (such as
 * Gemma 4's chat_template.jinja) do not crash when encountering missing `type`
 * properties or `type: "object"` definitions lacking a `properties` dictionary.
 */
export function sanitizeToolParameters(rawParams: any): Record<string, any> {
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) {
    return { type: "object", properties: {} };
  }

  const result: Record<string, any> = { ...rawParams };
  result.type = typeof result.type === "string" ? result.type : "object";

  if (result.type === "object") {
    const rawProps = result.properties;
    const sanitizedProps: Record<string, any> = {};
    if (rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)) {
      for (const [key, val] of Object.entries(rawProps)) {
        sanitizedProps[key] = sanitizePropertySchema(val);
      }
    }
    result.properties = sanitizedProps;
  }

  if (Array.isArray(result.required)) {
    result.required = result.required.filter((r: any) => typeof r === "string");
  }

  return result;
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
      description: tool.description || "",
      parameters: sanitizeToolParameters(tool.input_schema ?? tool.parameters),
    },
  }));
}
