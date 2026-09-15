/**
 * TypeScript type definitions for ShadowClaw headless CLI agent,
 * workspace configuration, and execution parameters.
 */

import type { ShadowClawDatabase } from "../db/types.js";

/**
 * Dedicated agent configuration section in shadow-claw.config.json.
 */
export interface ShadowClawAgentConfig {
  defaultProvider?: string;
  defaultModel?: string;
  provider?: string;
  model?: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  tools?: string[] | string;
  enabledTools?: string[] | string;
  toolsProfile?: string;
  defaultToolsProfile?: string;
  [key: string]: unknown;
}

/**
 * Settings section in shadow-claw.config.json or site-config.json.
 */
export interface ShadowClawWorkspaceSettings {
  defaultToolsProfile?: string;
  defaultProvider?: string;
  defaultModel?: string;
  agent?: ShadowClawAgentConfig;
  assistantName?: string;
  internetAccess?: boolean;
  vm_bash_full_internet_access?: boolean;
  fullInternetAccess?: boolean;
  [key: string]: unknown;
}

/**
 * Declarative workspace configuration (shadow-claw.config.json).
 */
export interface ShadowClawWorkspaceConfig {
  $schema?: string;
  site?: {
    title?: string;
    description?: string;
    themeColor?: string;
  };
  branding?: Record<string, unknown>;
  settings?: ShadowClawWorkspaceSettings;
  agent?: ShadowClawAgentConfig;
  defaultProvider?: string;
  defaultModel?: string;
  customElements?: {
    allowedElements?: string[];
    allowedDomains?: string[];
    scripts?: unknown[];
  };
  security?: {
    connectSrc?: string[];
  };
  [key: string]: unknown;
}

/**
 * Options for bootstrapHeadlessAgent.
 */
export interface BootstrapAgentOptions {
  workspace?: string;
  databaseDir?: string;
  cacheDir?: string;
  quiet?: boolean;
  verbose?: boolean;
  tmp?: boolean;
  temp?: boolean;
  yes?: boolean;
  y?: boolean;
  isTTY?: boolean;
  stdin?: any;
  stdout?: any;
}

/**
 * Result returned by bootstrapHeadlessAgent.
 */
export interface BootstrapAgentResult {
  db: ShadowClawDatabase;
  workspaceDir: string;
  dbPath: string;
  core: any;
}

/**
 * Options for runAgentInit.
 */
export interface AgentInitOptions {
  workspace?: string;
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by runAgentInit.
 */
export interface AgentInitResult {
  success: boolean;
  workspace: string;
}

/**
 * Options for runAgentRun.
 */
export interface AgentRunOptions {
  workspace?: string;
  group?: string;
  provider?: string;
  model?: string;
  apiKey?: string;
  maxTokens?: number;
  quiet?: boolean;
  verbose?: boolean;
  stream?: boolean;
  progress?: boolean;
  noProgress?: boolean;
  systemPrompt?: string;
  systemPromptFile?: string;
  tools?: string | string[] | boolean;
  toolsProfile?: string;
  noTools?: boolean;
  invokeHandler?: (db: ShadowClawDatabase, payload: any) => Promise<void>;
  [key: string]: unknown;
}

/**
 * Result returned by runAgentRun.
 */
export interface AgentRunResult {
  success: boolean;
  response?: string;
  error?: string;
  model?: string;
  provider?: string;
  [key: string]: unknown;
}

/**
 * Options for runAgentSkill.
 */
export interface AgentSkillOptions {
  workspace?: string;
  group?: string;
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by runAgentSkill.
 */
export interface AgentSkillResult {
  success: boolean;
  skill?: unknown;
  results?: unknown[];
  rawOutputs?: string[];
  message?: string;
  error?: string;
}

/**
 * Options for runAgentSkills.
 */
export interface AgentSkillsOptions {
  workspace?: string;
  group?: string;
  quiet?: boolean;
}

/**
 * Options for runAgentTools.
 */
export interface AgentToolsOptions {
  workspace?: string;
  quiet?: boolean;
  toolsProfile?: string;
  profile?: string;
  profiles?: boolean;
  [key: string]: unknown;
}

/**
 * Options for runAgentTool.
 */
export interface AgentToolOptions {
  workspace?: string;
  group?: string;
  input?: Record<string, any> | string;
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Result returned by runAgentTool.
 */
export interface AgentToolResult {
  success: boolean;
  tool?: unknown;
  headlessSafe?: boolean;
  output?: unknown;
  error?: string;
}

/**
 * Options for runAgentModel.
 */
export interface AgentModelOptions {
  workspace?: string;
  cacheDir?: string;
  quiet?: boolean;
  verbose?: boolean;
  progress?: boolean;
  noProgress?: boolean;
  download?: boolean;
  [key: string]: unknown;
}

/**
 * Result returned by runAgentModel.
 */
export interface AgentModelResult {
  success: boolean;
  subaction?: string;
  model?: string;
  models?: unknown[];
  path?: string;
  error?: string;
  [key: string]: unknown;
}
