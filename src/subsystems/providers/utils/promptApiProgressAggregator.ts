/**
 * Expected download size for the default Prompt API polyfill CPU model
 * (onnx-community/Qwen3-0.6B-ONNX / q4).
 * Approx 930 MB (919 MB model_q4.onnx + ~11 MB config/tokenizer).
 */
export const DEFAULT_PROMPT_API_MODEL_SIZE_BYTES = 930 * 1024 * 1024;

export interface PromptApiProgressOptions {
  expectedTotalBytes?: number;
  logEvents?: boolean;
  suppressInitialZero?: boolean;
}

export type PromptApiProgressEmitter = (
  status: "running" | "done" | "error",
  progress: number | null,
  message: string,
) => Promise<void> | void;

/**
 * Normalizes and monotonically aggregates model download progress from both
 * native browser Prompt API downloadprogress events and polyfilled Transformers.js / CacheStorage streams.
 */
export class PromptApiProgressAggregator {
  private readonly emitter: PromptApiProgressEmitter;
  private readonly expectedTotalBytes: number;
  private readonly logEvents: boolean;
  private readonly suppressInitialZero: boolean;
  private _hasEmitted: boolean = false;

  private urlBytesMap = new Map<
    string,
    { received: number; total: number | null; complete: boolean }
  >();
  private maxProgressFraction: number = 0;
  private maxLoadedBytes: number = 0;
  private maxEffectiveTotal: number = 0;
  private lastReportedMessage: string = "";
  private lastReportedFraction: number | null = null;

  constructor(
    emitter: PromptApiProgressEmitter,
    options?: PromptApiProgressOptions,
  ) {
    this.emitter = emitter;
    this.expectedTotalBytes =
      options?.expectedTotalBytes !== undefined
        ? options.expectedTotalBytes
        : DEFAULT_PROMPT_API_MODEL_SIZE_BYTES;
    this.logEvents = options?.logEvents ?? false;
    this.suppressInitialZero = options?.suppressInitialZero ?? false;
  }

  public get hasEmitted(): boolean {
    return this._hasEmitted;
  }

  public markActive(): void {
    this._hasEmitted = true;
  }

  /**
   * Handle byte stream progress from createModelCacheFetch / CacheStorage streaming.
   */
  public onStreamProgress(
    url: string,
    received: number,
    total: number | null,
    complete: boolean = false,
  ): void {
    if (!Number.isFinite(received) || received < 0) return;

    this.urlBytesMap.set(url, { received, total, complete });

    let sumReceived = 0;
    let sumTotal = 0;

    for (const entry of this.urlBytesMap.values()) {
      sumReceived += entry.received;
      if (
        entry.total != null &&
        Number.isFinite(entry.total) &&
        entry.total > 0
      ) {
        sumTotal += entry.total;
      }
    }

    const rawEffectiveTotal =
      this.expectedTotalBytes > 0
        ? Math.max(sumTotal, this.expectedTotalBytes)
        : sumTotal;
    this.maxEffectiveTotal = Math.max(
      this.maxEffectiveTotal,
      rawEffectiveTotal,
    );
    const effectiveTotal = this.maxEffectiveTotal;

    this.maxLoadedBytes = Math.max(this.maxLoadedBytes, sumReceived);

    if (effectiveTotal > 0) {
      const fraction = Math.min(1, this.maxLoadedBytes / effectiveTotal);
      this.maxProgressFraction = Math.max(this.maxProgressFraction, fraction);

      const loadedMB = (this.maxLoadedBytes / (1024 * 1024)).toFixed(1);
      const totalMB = (effectiveTotal / (1024 * 1024)).toFixed(1);
      const percent = Math.round(this.maxProgressFraction * 100);

      const message = `Downloading Prompt API model... (${loadedMB} / ${totalMB} MB · ${percent}%)`;
      this.emit(this.maxProgressFraction, message);
    } else {
      const loadedMB = (this.maxLoadedBytes / (1024 * 1024)).toFixed(1);
      const message = `Downloading Prompt API model... (${loadedMB} MB downloaded)`;
      this.emit(null, message);
    }
  }

  public onProgressEvent(event: any): void {
    const loaded = Number((event as any)?.loaded);
    const total = Number((event as any)?.total);

    if (this.logEvents) {
      console.log("[PromptApiProgressAggregator] onProgressEvent:", {
        loaded,
        total,
        type: event?.type,
      });
    }

    if (!Number.isFinite(loaded) || loaded < 0) {
      return;
    }

    if (
      this.suppressInitialZero &&
      !this._hasEmitted &&
      loaded === 0 &&
      (!Number.isFinite(total) || total <= 1)
    ) {
      return;
    }

    // Case 1: Bytes with a known valid total (Native Chrome provides this in recent versions)
    if (Number.isFinite(total) && total > 1) {
      const fraction = Math.max(0, Math.min(1, loaded / total));
      this.maxProgressFraction = Math.max(this.maxProgressFraction, fraction);
      const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (total / (1024 * 1024)).toFixed(1);
      const percent = Math.round(this.maxProgressFraction * 100);
      this.emit(
        this.maxProgressFraction,
        `Downloading Prompt API model... (${loadedMB} / ${totalMB} MB · ${percent}%)`,
      );
      return;
    }

    // Case 2: Normalized fraction (0 <= loaded <= 1) (Polyfill fake events often use this)
    if (loaded >= 0 && loaded <= 1) {
      const rawFraction = Math.max(0, Math.min(1, loaded));
      this.maxProgressFraction = Math.max(
        this.maxProgressFraction,
        rawFraction,
      );

      if (this.expectedTotalBytes > 0) {
        const estimatedBytes = Math.round(
          this.maxProgressFraction * this.expectedTotalBytes,
        );
        const loadedMB = (estimatedBytes / (1024 * 1024)).toFixed(1);
        const totalMB = (this.expectedTotalBytes / (1024 * 1024)).toFixed(1);
        const percent = Math.round(this.maxProgressFraction * 100);
        this.emit(
          this.maxProgressFraction,
          `Downloading Prompt API model... (${loadedMB} / ${totalMB} MB · ${percent}%)`,
        );
      } else {
        const percent = Math.round(this.maxProgressFraction * 100);
        this.emit(
          this.maxProgressFraction,
          `Downloading Prompt API model... ${percent}%`,
        );
      }
      return;
    }

    // Case 3: Raw bytes but no total known
    if (loaded > 1) {
      if (this.expectedTotalBytes > 0) {
        const rawTotal = Math.max(loaded, this.expectedTotalBytes);
        const fraction = Math.min(1, loaded / rawTotal);
        this.maxProgressFraction = Math.max(this.maxProgressFraction, fraction);
        const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
        const totalMB = (rawTotal / (1024 * 1024)).toFixed(1);
        const percent = Math.round(this.maxProgressFraction * 100);
        this.emit(
          this.maxProgressFraction,
          `Downloading Prompt API model... (${loadedMB} / ${totalMB} MB · ${percent}%)`,
        );
      } else {
        const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
        this.emit(
          null,
          `Downloading Prompt API model... (${loadedMB} MB downloaded)`,
        );
      }
      return;
    }
  }

  public onDone(): void {
    this.maxProgressFraction = 1;
    void this.emitter("done", 1, "Prompt API model ready.");
  }

  public onError(err: any): void {
    const msg = err instanceof Error ? err.message : String(err);
    void this.emitter("error", null, msg);
  }

  private emit(fraction: number | null, message: string): void {
    this._hasEmitted = true;
    if (
      this.lastReportedMessage === message &&
      this.lastReportedFraction === fraction
    ) {
      return;
    }
    this.lastReportedMessage = message;
    this.lastReportedFraction = fraction;
    void this.emitter("running", fraction, message);
  }
}
