import type { SurfaceState } from "../../../components/types.js";

// A render callback that returns an HTMLElement or null
export type ComponentRenderCallback = (
  spec: any,
  surface: SurfaceState,
  context: Record<string, any>,
) => HTMLElement | null;

export class ComponentRegistry {
  private renderers = new Map<string, ComponentRenderCallback>();

  register(
    componentName: string,
    renderCallback: ComponentRenderCallback,
  ): void {
    this.renderers.set(componentName, renderCallback);
  }

  get(componentName: string): ComponentRenderCallback | undefined {
    return this.renderers.get(componentName);
  }
}

// Global default registry
export const globalComponentRegistry = new ComponentRegistry();
