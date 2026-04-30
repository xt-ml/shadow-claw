import { Signal } from "signal-polyfill";

/**
 * UI-only state for the Chat page.
 */
export class ChatUiStore {
  private _isNearBottom: Signal.State<boolean>;
  private _nearBottomSnapshot: boolean;
  private _attachmentObjectUrls: Set<string>;
  private _scrollStateByGroup: Map<
    string,
    { distanceFromBottom: number; nearBottom: boolean }
  >;

  constructor() {
    this._isNearBottom = new Signal.State(true);
    this._nearBottomSnapshot = true;
    this._attachmentObjectUrls = new Set();
    this._scrollStateByGroup = new Map();
  }

  get isNearBottom(): boolean {
    return this._isNearBottom.get();
  }

  get nearBottomSnapshot(): boolean {
    return this._nearBottomSnapshot;
  }

  setNearBottom(nearBottom: boolean): void {
    this._nearBottomSnapshot = nearBottom;
    this._isNearBottom.set(nearBottom);
  }

  resetNearBottom(): void {
    this._nearBottomSnapshot = true;
    this._isNearBottom.set(true);
  }

  setGroupScrollState(
    groupId: string,
    distanceFromBottom: number,
    nearBottom: boolean,
  ): void {
    this._scrollStateByGroup.set(groupId, {
      distanceFromBottom,
      nearBottom,
    });
  }

  getGroupScrollState(
    groupId: string,
  ): { distanceFromBottom: number; nearBottom: boolean } | null {
    return this._scrollStateByGroup.get(groupId) ?? null;
  }

  registerAttachmentObjectUrl(url: string): void {
    this._attachmentObjectUrls.add(url);
  }

  revokeAttachmentObjectUrls(): void {
    for (const objectUrl of this._attachmentObjectUrls) {
      URL.revokeObjectURL(objectUrl);
    }

    this._attachmentObjectUrls.clear();
  }

  reset(): void {
    this.revokeAttachmentObjectUrls();
    this._scrollStateByGroup.clear();
    this.resetNearBottom();
  }
}

export const chatUiStore = new ChatUiStore();
