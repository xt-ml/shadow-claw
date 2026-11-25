import type { languages } from "monaco-editor";

/**
 * Mermaid diagram language (Monarch tokenizer). Monaco does not ship Mermaid
 * support, so this keeps it dependency free.
 */
export const MERMAID_LANGUAGE_ID = "mermaid";

export const mermaidLanguageConfiguration: languages.LanguageConfiguration = {
  comments: { lineComment: "%%" },
  brackets: [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
  ],
  autoClosingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"', notIn: ["comment"] },
  ],
  surroundingPairs: [
    { open: "{", close: "}" },
    { open: "[", close: "]" },
    { open: "(", close: ")" },
    { open: '"', close: '"' },
  ],
};

export const mermaidLanguage = {
  defaultToken: "",
  tokenPostfix: ".mermaid",
  ignoreCase: false,

  diagramTypes: [
    "graph",
    "flowchart",
    "flowchart-elk",
    "sequenceDiagram",
    "classDiagram",
    "classDiagram-v2",
    "stateDiagram",
    "stateDiagram-v2",
    "erDiagram",
    "journey",
    "gantt",
    "pie",
    "quadrantChart",
    "requirementDiagram",
    "gitGraph",
    "mindmap",
    "timeline",
    "zenuml",
    "sankey-beta",
    "xychart-beta",
    "block-beta",
    "packet-beta",
    "architecture-beta",
    "kanban",
    "C4Context",
    "C4Container",
    "C4Component",
    "C4Dynamic",
    "C4Deployment",
  ],

  keywords: [
    "subgraph",
    "end",
    "direction",
    "participant",
    "actor",
    "as",
    "loop",
    "alt",
    "else",
    "opt",
    "par",
    "and",
    "critical",
    "option",
    "break",
    "rect",
    "note",
    "over",
    "of",
    "left",
    "right",
    "activate",
    "deactivate",
    "autonumber",
    "title",
    "section",
    "accTitle",
    "accDescr",
    "class",
    "classDef",
    "click",
    "style",
    "linkStyle",
    "callback",
    "link",
    "dateFormat",
    "axisFormat",
    "excludes",
    "includes",
    "todayMarker",
    "commit",
    "branch",
    "checkout",
    "merge",
    "cherry-pick",
    "state",
    "namespace",
    "interface",
    "enum",
    "done",
    "active",
    "crit",
    "milestone",
  ],

  directions: ["TB", "TD", "BT", "RL", "LR"],

  tokenizer: {
    root: [
      [/^\s*%%\{/, { token: "annotation", next: "@directive" }],
      [/%%.*$/, "comment"],
      [
        /[A-Za-z][\w-]*/,
        {
          cases: {
            "@diagramTypes": "keyword.diagram",
            "@keywords": "keyword",
            "@directions": "constant",
            "@default": "identifier",
          },
        },
      ],
      [/"/, { token: "string.quote", next: "@string" }],
      [/`/, { token: "string.quote", next: "@markdownString" }],
      [/[-=.]{2,}[>ox)]?|-[>)x]>?/, "operator"],
      [/:::?[\w-]+/, "type"],
      [/:[^\n]*$/, "string"],
      [/\|[^|\n]*\|/, "string"],
      [/\d+(?:\.\d+)?/, "number"],
      [/[{}()[\]]/, "@brackets"],
      [/[;,]/, "delimiter"],
      [/[<>=~|&*/+-]+/, "operator"],
      [/\s+/, "white"],
    ],

    string: [
      [/[^"]+/, "string"],
      [/"/, { token: "string.quote", next: "@pop" }],
    ],

    markdownString: [
      [/[^`]+/, "string"],
      [/`/, { token: "string.quote", next: "@pop" }],
    ],

    directive: [
      [/\}%%/, { token: "annotation", next: "@pop" }],
      [/[^}]+/, "annotation"],
      [/\}/, "annotation"],
    ],
  },
} as languages.IMonarchLanguage & Record<string, unknown>;
