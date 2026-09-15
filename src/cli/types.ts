/**
 * ShadowClaw CLI — Core Types & Interfaces
 *
 * Provides shared, exportable types across CLI commands, options,
 * and external consumers/scripts.
 */

export interface CliGlobalOptions {
  contentRoot?: string;
  cacheDir?: string;
  databaseDir?: string;
  toolchainRoot?: string;
  quiet?: boolean;
  verbose?: boolean;
  yes?: boolean;
  tmp?: boolean;
  temp?: boolean;
  isTTY?: boolean;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
}

export interface CliCommandResult {
  success: boolean;
  error?: string;
  exitCode?: number;
  [key: string]: unknown;
}

export type TerminationCleanupFn = (signal: string) => void;
