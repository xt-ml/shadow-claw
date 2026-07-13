import type { TextFieldSpec, A2UIComponentSpec } from "../ui/a2ui.js";
export type AttachModalOverlayFn = (overlay: HTMLElement) => void;
export type DispatchActionFn = (actionId: string) => void;

export type PageHeaderLikeElement = HTMLElement & {
  isMainCollapsed?: () => boolean;
  setMainCollapsedOverride?: (collapsed: boolean | null) => void;
};

export type ProviderHelpType =
  | "api-key-missing"
  | "api-key-invalid"
  | "provider-unreachable"
  | "rate-limited";

export type RenderComponentFn = (id: string) => HTMLElement | null;

export type ResolveConnectionTestAuthResult =
  | {
      authType: "oauth";
      accessToken: string;
    }
  | {
      authType: "basic_userpass";
      password: string;
    }
  | {
      error: string;
    };

export type ResolveMediaUrlFn = (input: string) => string;
export type UpdateDataModelKeyFn = (
  spec: TextFieldSpec,
  newValue: string,
) => void;

export type UpdateDataModelPointerFn = (
  pointer: string,
  value: unknown,
) => void;

export interface LocalModelRankCandidate {
  id: string;
  supportsTools: boolean;
  contextLength: number;
}

export interface PdfFile {
  name: string;
  binaryContent: Uint8Array | null;
}

export interface RenderContext {
  renderComponent: RenderComponentFn;
  dispatchAction: DispatchActionFn;
  updateDataModelKey: UpdateDataModelKeyFn;
  updateDataModelPointer: UpdateDataModelPointerFn;
  resolveMediaUrl: ResolveMediaUrlFn;
  attachModalOverlay?: AttachModalOverlayFn;
}

export interface ResolveConnectionTestAuthInput {
  authMode: string | null | undefined;
  pendingOauthAccessToken?: string;
  passwordInput?: string;
  hasStoredOauthCredential?: boolean;
  hasStoredPasswordCredential?: boolean;
}

export interface SurfaceState {
  surfaceId: string;
  components: Record<string, A2UIComponentSpec>;
  dataModel: Record<string, unknown>;
  rootComponentId: string;
}
