import { Signal } from "signal-polyfill";

/**
 * UI-only state for the Files page.
 */
export class FilesUiStore {
  private _isDragActive: Signal.State<boolean>;
  private _uploadCompleted: Signal.State<number>;
  private _uploadTotal: Signal.State<number>;

  constructor() {
    this._isDragActive = new Signal.State(false);
    this._uploadCompleted = new Signal.State(0);
    this._uploadTotal = new Signal.State(0);
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
}

export const filesUiStore = new FilesUiStore();
