import type { OpenApiPathItem } from "../types.js";

export const diagnosticPaths: Record<string, OpenApiPathItem> = {
  "/activity-log": {
    post: {
      tags: ["Diagnostics & Logging"],
      summary: "Record Activity Log",
      description:
        "Appends client activity log records to server disk storage.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                level: { type: "string" },
                message: { type: "string" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      responses: {
        "200": { description: "Log recorded" },
        "500": { description: "Logging error" },
      },
    },
  },
  "/__cspreport": {
    post: {
      tags: ["Diagnostics & Logging"],
      summary: "Receive CSP Violation Report",
      description:
        "Receives Content Security Policy violation reports from browser clients.",
      requestBody: {
        required: true,
        content: {
          "application/csp-report": { schema: { type: "object" } },
          "application/json": { schema: { type: "object" } },
        },
      },
      responses: {
        "204": { description: "Report received" },
      },
    },
  },
};
