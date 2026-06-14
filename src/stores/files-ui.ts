import { Signal } from "signal-polyfill";

export interface ClipboardItem {
  sourceGroupId: string;
  sourcePath: string;
  type: "cut" | "copy";
  isDirectory: boolean;
}

/**
 * UI-only state for the Files page.
 */
export class FilesUiStore {
  private _isDragActive: Signal.State<boolean>;
  private _uploadCompleted: Signal.State<number>;
  private _uploadTotal: Signal.State<number>;
  private _clipboard: Signal.State<ClipboardItem | null>;

  constructor() {
    this._isDragActive = new Signal.State(false);
    this._uploadCompleted = new Signal.State(0);
    this._uploadTotal = new Signal.State(0);
    this._clipboard = new Signal.State<ClipboardItem | null>(null);
  }

  get isDragActive(): boolean {
    return this._isDragActive.get();
  }

  get uploadCompleted(): number {
    return this._uploadCompleted.get();
  }

  get uploadTotal(): number {
    return this._uploadTotal.get();
  }

  get clipboard(): ClipboardItem | null {
    return this._clipboard.get();
  }

  setDragActive(active: boolean): void {
    this._isDragActive.set(active);
  }

  startUpload(total: number): void {
    this._uploadTotal.set(total);
    this._uploadCompleted.set(0);
  }

  setUploadCompleted(completed: number): void {
    this._uploadCompleted.set(completed);
  }

  resetUpload(): void {
    this._uploadTotal.set(0);
    this._uploadCompleted.set(0);
  }

  setClipboard(
    sourcePath: string,
    type: "cut" | "copy",
    isDirectory: boolean,
    sourceGroupId: string,
  ): void {
    this._clipboard.set({ sourcePath, type, isDirectory, sourceGroupId });
  }

  clearClipboard(): void {
    this._clipboard.set(null);
  }
}

export const filesUiStore = new FilesUiStore();
