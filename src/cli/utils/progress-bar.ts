import process from "node:process";

export interface ProgressBarOptions {
  modelId?: string;
  stream?: any;
  barWidth?: number;
  isTTY?: boolean;
  enabled?: boolean;
}

export interface ProgressInfo {
  status?: "initiate" | "progress" | "progress_total" | "done" | string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
  [key: string]: unknown;
}

export interface CliProgressBar {
  update: (info: ProgressInfo) => void;
  finish: (message?: string) => void;
  fail: (message?: string) => void;
}

/**
 * Format bytes into human-readable string (B, KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const idx = Math.min(i, sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, idx)).toFixed(dm))} ${sizes[idx]}`;
}

/**
 * Creates a progress bar instance for model downloads.
 */
export function createCliProgressBar(
  options: ProgressBarOptions = {},
): CliProgressBar {
  const {
    modelId = "model",
    stream = process.stderr,
    barWidth = 24,
    isTTY = Boolean(stream && typeof stream === "object" && stream.isTTY),
    enabled = true,
  } = options;

  if (!enabled) {
    return {
      update: () => {},
      finish: () => {},
      fail: (message?: string) => {
        if (stream?.write) {
          stream.write(`${message || `✖ Failed to download ${modelId}.`}\n`);
        }
      },
    };
  }

  const fileOrder: string[] = [];
  const fileState = new Map<
    string,
    {
      lineIndex: number;
      lastPct: number;
      lastRenderedTime: number;
      loaded: number;
      total: number;
      isDone: boolean;
    }
  >();
  let isFinished = false;

  function renderBar(fraction: number): string {
    const clamped = Math.max(0, Math.min(1, fraction));
    const filled = Math.round(clamped * barWidth);
    const empty = barWidth - filled;
    return (
      "[" +
      "=".repeat(filled) +
      (filled < barWidth ? ">" : "") +
      " ".repeat(Math.max(0, empty - (filled < barWidth ? 1 : 0))) +
      "]"
    );
  }

  function getOrCreateFileEntry(
    fileKey: string,
    initialLoaded: number = 0,
    initialTotal: number = 0,
  ) {
    let entry = fileState.get(fileKey);
    if (!entry) {
      entry = {
        lineIndex: fileOrder.length,
        lastPct: -1,
        lastRenderedTime: 0,
        loaded: initialLoaded,
        total: initialTotal,
        isDone: false,
      };
      fileState.set(fileKey, entry);
      fileOrder.push(fileKey);
      if (isTTY && fileOrder.length > 1 && stream?.write) {
        stream.write("\n");
      }
    }
    return entry;
  }

  function writeLineForFile(fileKey: string, str: string): void {
    if (!isTTY || !stream?.write) return;

    const entry = fileState.get(fileKey);
    if (!entry) return;

    const cols =
      typeof stream.columns === "number" && stream.columns > 0
        ? stream.columns
        : null;
    const clampedStr =
      cols && str.length > cols - 1 ? str.slice(0, cols - 1) : str;

    const currentBottomIndex = fileOrder.length - 1;
    const diff = currentBottomIndex - entry.lineIndex;

    if (diff > 0) {
      stream.write(`\x1b[${diff}A\r\x1b[2K${clampedStr}\x1b[${diff}B\r`);
    } else {
      stream.write(`\r\x1b[2K${clampedStr}`);
    }
  }

  function update(info: ProgressInfo): void {
    if (isFinished || !info) return;

    const fileKey =
      info.file || (info.status === "progress_total" ? "Total" : modelId);

    if (info.status === "initiate") {
      getOrCreateFileEntry(fileKey);
      if (!isTTY && stream?.write) {
        stream.write(
          `[Download] Starting ${modelId}${fileKey ? ` (${fileKey})` : ""}...\n`,
        );
      } else if (isTTY) {
        const fileStr = fileKey ? ` [${fileKey}]` : "";
        writeLineForFile(
          fileKey,
          `Downloading ${modelId}${fileStr} ${renderBar(0)}   0.0%`,
        );
      }
      return;
    }

    if (info.status === "progress" || info.status === "progress_total") {
      const rawPct = typeof info.progress === "number" ? info.progress : 0;
      const pct = Math.max(0, Math.min(100, rawPct));
      const fraction = pct / 100;
      const loaded = Number(info.loaded) || 0;
      const total = Number(info.total) || 0;

      const entry = getOrCreateFileEntry(fileKey, loaded, total);
      const now = Date.now();

      if (isTTY) {
        if (
          now - entry.lastRenderedTime < 30 &&
          pct < 100 &&
          Math.abs(pct - entry.lastPct) < 0.5
        ) {
          return;
        }
        entry.lastRenderedTime = now;
        entry.lastPct = pct;
        entry.loaded = loaded;
        entry.total = total;

        const bar = renderBar(fraction);
        const pctStr = `${pct.toFixed(1)}%`.padStart(6, " ");
        let sizeInfo = "";
        if (total > 0) {
          sizeInfo = ` (${formatBytes(loaded)} / ${formatBytes(total)})`;
        } else if (loaded > 0) {
          sizeInfo = ` (${formatBytes(loaded)})`;
        }
        const fileStr = fileKey ? ` [${fileKey}]` : "";
        writeLineForFile(
          fileKey,
          `Downloading ${modelId}${fileStr} ${bar} ${pctStr}${sizeInfo}`,
        );
      } else {
        const milestone = Math.floor(pct / 20) * 20;
        if (milestone > entry.lastPct && (milestone > 0 || pct === 0)) {
          entry.lastPct = milestone;
          const sizeInfo =
            total > 0
              ? ` (${formatBytes(loaded)} / ${formatBytes(total)})`
              : "";
          if (stream?.write) {
            stream.write(
              `[Download] ${modelId}${fileKey ? ` [${fileKey}]` : ""}: ${milestone}%${sizeInfo}\n`,
            );
          }
        }
      }
      return;
    }

    if (info.status === "done") {
      const entry = fileState.get(fileKey);
      if (entry) {
        entry.isDone = true;
        if (isTTY) {
          const bar = renderBar(1);
          const totalSize = entry.total || entry.loaded;
          const sizeInfo = totalSize > 0 ? ` (${formatBytes(totalSize)})` : "";
          const fileStr = fileKey ? ` [${fileKey}]` : "";
          writeLineForFile(
            fileKey,
            `Downloading ${modelId}${fileStr} ${bar} 100.0%${sizeInfo}`,
          );
        } else if (stream?.write) {
          stream.write(`[Download] Finished file: ${fileKey}\n`);
        }
      } else if (!isTTY && info.file && stream?.write) {
        stream.write(`[Download] Finished file: ${info.file}\n`);
      }
    }
  }

  function finish(message?: string): void {
    if (isFinished) return;
    isFinished = true;
    const defaultMsg = `✔ Model ${modelId} downloaded successfully.`;
    if (isTTY && stream?.write) {
      if (fileOrder.length > 0) {
        stream.write(`\n${message || defaultMsg}\n`);
      } else {
        stream.write(`${message || defaultMsg}\n`);
      }
    } else if (stream?.write) {
      stream.write(`${message || defaultMsg}\n`);
    }
  }

  function fail(message?: string): void {
    if (isFinished) return;
    isFinished = true;
    const defaultMsg = `✖ Failed to download ${modelId}.`;
    if (isTTY && stream?.write) {
      if (fileOrder.length > 0) {
        stream.write(`\n${message || defaultMsg}\n`);
      } else {
        stream.write(`${message || defaultMsg}\n`);
      }
    } else if (stream?.write) {
      stream.write(`${message || defaultMsg}\n`);
    }
  }

  return {
    update,
    finish,
    fail,
  };
}
