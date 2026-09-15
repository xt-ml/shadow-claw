import { getProjectRoot } from "./resolve-project-root.js";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const toolchainRoot = getProjectRoot(import.meta.url);

let cachedCore: any = null;

export async function getAgentCore(): Promise<any> {
  if (cachedCore) {
    return cachedCore;
  }

  const isTest = process.env.NODE_ENV === "test";
  const distAgentPath = path.join(toolchainRoot, "dist/headless-agent.js");

  // In non-test environments or when dist exists and not testing
  if (!isTest && existsSync(distAgentPath)) {
    cachedCore = await import(pathToFileURL(distAgentPath).href);
    return cachedCore;
  }

  // Load from src/worker/headless-agent directly
  try {
    const headlessAgent = await import("../../worker/headless-agent.js");
    cachedCore = { ...headlessAgent };
    return cachedCore;
  } catch (_tsErr) {
    try {
      const headlessAgent = await import("../../worker/headless-agent.js");
      cachedCore = { ...headlessAgent };
      return cachedCore;
    } catch (err) {
      if (existsSync(distAgentPath)) {
        const mod = await import(pathToFileURL(distAgentPath).href);
        cachedCore = { ...mod };
        return cachedCore;
      }
      throw err;
    }
  }
}
