import {
  parseLocalModelToolCall,
  convertToolSchemasToOpenAI,
} from "./parseLocalModelToolCall.js";

describe("parseLocalModelToolCall", () => {
  // ── Gemma 4 "call:" grammar ─────────────────────────────────────────────
  describe("Gemma call: syntax", () => {
    it("parses basic call:<name>{...} with JSON values", () => {
      const result = parseLocalModelToolCall(
        'call:fetch_url{"url":"https://api.weather.com/v1"}',
      );
      expect(result).toEqual({
        name: "fetch_url",
        input: { url: "https://api.weather.com/v1" },
      });
    });

    it("parses call: <name> { key: value } with spaces and colons", () => {
      const result = parseLocalModelToolCall(
        'call: get_weather { location: "Chicago, IL" }',
      );
      expect(result).toEqual({
        name: "get_weather",
        input: { location: "Chicago, IL" },
      });
    });

    it("strips <|end_of_turn|> token before parsing", () => {
      const result = parseLocalModelToolCall(
        'call:bash{"command":"ls -la"}<|end_of_turn|>',
      );
      expect(result).toEqual({
        name: "bash",
        input: { command: "ls -la" },
      });
    });

    it("strips <|tool_call> token before parsing", () => {
      const result = parseLocalModelToolCall(
        '<|tool_call>call:fetch_url{"url":"https://example.com"}',
      );
      expect(result).toEqual({
        name: "fetch_url",
        input: { url: "https://example.com" },
      });
    });

    it("parses multiple arguments", () => {
      const result = parseLocalModelToolCall(
        'call:write_file{"path":"/tmp/out.txt","content":"hello world"}',
      );
      expect(result).toEqual({
        name: "write_file",
        input: { path: "/tmp/out.txt", content: "hello world" },
      });
    });

    it("handles numeric values", () => {
      const result = parseLocalModelToolCall("call:sleep{seconds:30}");
      expect(result).toEqual({ name: "sleep", input: { seconds: 30 } });
    });

    it("handles boolean values", () => {
      const result = parseLocalModelToolCall("call:read_file{recursive:true}");
      expect(result).toEqual({ name: "read_file", input: { recursive: true } });
    });
  });

  // ── <execute_tool> tag grammar ───────────────────────────────────────────
  describe("<execute_tool> tag syntax", () => {
    it("parses <execute_tool> name(key=value) </execute_tool>", () => {
      const result = parseLocalModelToolCall(
        '<execute_tool> bash(command="echo hello") </execute_tool>',
      );
      expect(result).toEqual({
        name: "bash",
        input: { command: "echo hello" },
      });
    });

    it("is case-insensitive for the tag name", () => {
      const result = parseLocalModelToolCall(
        '<Execute_Tool> read_file(path="/etc/hosts") </Execute_Tool>',
      );
      expect(result).toEqual({
        name: "read_file",
        input: { path: "/etc/hosts" },
      });
    });
  });

  // ── Qwen 3 [tool_code] grammar ───────────────────────────────────────────
  describe("Qwen [tool_code] syntax", () => {
    it("parses [tool_code] print(name({...})) [/tool_code]", () => {
      const result = parseLocalModelToolCall(
        '[tool_code]\nprint(fetch_url({"url": "https://api.example.com"}))\n[/tool_code]',
      );
      expect(result).toEqual({
        name: "fetch_url",
        input: { url: "https://api.example.com" },
      });
    });

    it("parses direct [tool_code] name({...}) [/tool_code] without print", () => {
      const result = parseLocalModelToolCall(
        '[tool_code]\nbash({"command": "ls -la"})\n[/tool_code]',
      );
      expect(result).toEqual({ name: "bash", input: { command: "ls -la" } });
    });

    it("returns null for [tool_code] with non-JSON args", () => {
      // The Qwen parser requires strict JSON for the args block
      const result = parseLocalModelToolCall(
        "[tool_code]\nbash(command='ls')\n[/tool_code]",
      );
      expect(result).toBeNull();
    });
  });

  // ── No-match cases ────────────────────────────────────────────────────────
  describe("null cases", () => {
    it("returns null for plain text response", () => {
      expect(
        parseLocalModelToolCall("The weather in Chicago is 72°F."),
      ).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(parseLocalModelToolCall("")).toBeNull();
    });

    it("returns null for only special tokens", () => {
      expect(parseLocalModelToolCall("<|end_of_turn|>")).toBeNull();
    });

    it("returns null for partial call pattern", () => {
      expect(parseLocalModelToolCall("call:")).toBeNull();
    });
  });
});

// ── convertToolSchemasToOpenAI ────────────────────────────────────────────
describe("convertToolSchemasToOpenAI", () => {
  it("converts internal schema to OpenAI function format", () => {
    const tools = [
      {
        name: "fetch_url",
        description: "Fetches a URL and returns the response body.",
        input_schema: {
          type: "object",
          properties: { url: { type: "string" } },
          required: ["url"],
        },
      },
    ];

    const result = convertToolSchemasToOpenAI(tools);
    expect(result).toEqual([
      {
        type: "function",
        function: {
          name: "fetch_url",
          description: "Fetches a URL and returns the response body.",
          parameters: {
            type: "object",
            properties: { url: { type: "string" } },
            required: ["url"],
          },
        },
      },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(convertToolSchemasToOpenAI([])).toEqual([]);
  });

  it("handles tools with no input_schema", () => {
    const result = convertToolSchemasToOpenAI([
      { name: "ping", description: "Ping tool" },
    ]);
    expect(result[0]?.function.parameters).toEqual({});
  });
});
