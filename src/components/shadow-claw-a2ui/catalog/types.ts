import type { A2UIComponentSpec, TextFieldSpec } from "../../../ui/a2ui.js";

export interface SurfaceState {
  surfaceId: string;
  components: Record<string, A2UIComponentSpec>;
  dataModel: Record<string, unknown>;
  rootComponentId: string;
}

export type RenderComponentFn = (id: string) => HTMLElement | null;
export type DispatchActionFn = (actionId: string) => void;
export type UpdateDataModelKeyFn = (
  spec: TextFieldSpec,
  newValue: string,
) => void;
export type UpdateDataModelPointerFn = (
  pointer: string,
  value: unknown,
) => void;
export type ResolveMediaUrlFn = (input: string) => string;
export type AttachModalOverlayFn = (overlay: HTMLElement) => void;

export interface RenderContext {
  renderComponent: RenderComponentFn;
  dispatchAction: DispatchActionFn;
  updateDataModelKey: UpdateDataModelKeyFn;
  updateDataModelPointer: UpdateDataModelPointerFn;
  resolveMediaUrl: ResolveMediaUrlFn;
  attachModalOverlay?: AttachModalOverlayFn;
}
