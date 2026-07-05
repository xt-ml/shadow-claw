import type { ToolDefinition } from "./types.js";

export const attach_file_to_chat: ToolDefinition = {
  name: "attach_file_to_chat",
  description:
    "Prepare a workspace file for chat delivery by generating an exact markdown attachment snippet. " +
    "Validates the file path and returns markdown that works for inline image rendering in ShadowClaw " +
    "and attachment upload in external channels like Telegram/iMessage.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the group workspace root",
      },
      alt: {
        type: "string",
        description:
          "Optional alt/caption text to use in the generated markdown",
      },
    },
    required: ["path"],
  },
};

export const diff_files: ToolDefinition = {
  name: "diff_files",
  description:
    "Compare two files in the workspace and output the differences. " +
    "Useful for comparing generated code, checking before patching, or finding changes outside of git repositories.",
  input_schema: {
    type: "object",
    properties: {
      path_a: {
        type: "string",
        description:
          "Path to the first file relative to the group workspace root.",
      },
      path_b: {
        type: "string",
        description:
          "Path to the second file relative to the group workspace root.",
      },
    },
    required: ["path_a", "path_b"],
  },
};

export const list_files: ToolDefinition = {
  name: "list_files",
  description:
    "List files and directories in the group workspace. " +
    "Directory names end with /. Returns sorted entries.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Directory path relative to workspace root (default: root)",
      },
    },
  },
};

export const open_file: ToolDefinition = {
  name: "open_file",
  description:
    "Open a file from the group workspace in the UI file viewer dialog. " +
    "Use this only when the user explicitly asks to inspect a file visually with preview support. " +
    "Do not use this tool to send or attach files in chat responses.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the group workspace root",
      },
    },
    required: ["path"],
  },
};

export const patch_file: ToolDefinition = {
  name: "patch_file",
  description:
    "Make a targeted text replacement in a file. " +
    "Finds the single occurrence of old_string and replaces it with new_string. " +
    "Fails if old_string is not found or matches more than once. " +
    "Use this instead of write_file when you only need to change part of a file — " +
    "it is safer and works well with large files. " +
    "Include enough surrounding context in old_string to make the match unique.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the group workspace root",
      },
      old_string: {
        type: "string",
        description:
          "The exact text to find in the file. Must match exactly once. " +
          "Include 2-3 lines of surrounding context to ensure a unique match.",
      },
      new_string: {
        type: "string",
        description: "The replacement text. Can be empty to delete old_string.",
      },
    },
    required: ["path", "old_string", "new_string"],
  },
};

export const read_file: ToolDefinition = {
  name: "read_file",
  description:
    "Read the contents of one or more files from the group workspace. " +
    "Pass a single path or an array of paths to read multiple files at once. " +
    "When paths is provided, returns all file contents concatenated with " +
    "--- filename --- headers. Prefer paths to batch reads in a single call." +
    "Image files (png, jpg, gif, webp, etc.) are returned as native image content " +
    "that the model can see directly. Other binary files will be detected and " +
    "an error returned suggesting alternative tools.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Single file path relative to the group workspace root",
      },
      paths: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of file paths relative to the group workspace root. " +
          "Use this to read multiple files in a single tool call.",
      },
    },
  },
};

export const search_files: ToolDefinition = {
  name: "search_files",
  description:
    "Search for a pattern (regex or exact text) in files across the workspace. " +
    "Useful for finding code references, function definitions, or specific content " +
    "without needing to rely on a shell environment.",
  input_schema: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "The text or regular expression to search for.",
      },
      path: {
        type: "string",
        description:
          "Optional directory path to restrict the search to (e.g. 'src/'). Defaults to workspace root.",
      },
      file_glob: {
        type: "string",
        description:
          "Optional simple glob to filter files (e.g. '*.ts'). Supports * as wildcard.",
      },
      is_regex: {
        type: "boolean",
        description:
          "Set to true to parse the pattern as a regular expression.",
      },
    },
    required: ["pattern"],
  },
};

export const send_file: ToolDefinition = {
  name: "send_file",
  description:
    "Send a workspace file directly to the current peer over the P2P (PeerJS/WebRTC) data channel. " +
    "Use this when the user is in a peer conversation and explicitly asks to send or transfer a file to their peer. " +
    "Do NOT use this for local-browser or non-peer conversations — it only works when the active conversation " +
    "is a peer: group. The file is read from the current group workspace and transferred in binary chunks " +
    "so there is no size limit.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the group workspace root",
      },
    },
    required: ["path"],
  },
};

export const write_file: ToolDefinition = {
  name: "write_file",
  description:
    "Write content to a file in the group workspace. " +
    "Creates the file and any intermediate directories if they don't exist. " +
    "Overwrites the file if it already exists.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path relative to the group workspace root",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
    },
    required: ["path", "content"],
  },
};
