export type CallableBoundary = "rendererOnly" | "agentOnly" | "rendererOrAgent";

export interface FunctionDefinition {
  name: string;
  callableFrom: CallableBoundary;
  evaluate: (
    args: Record<string, any>,
    context: { dataModel: Record<string, unknown> },
  ) => any;
}

export class FunctionRegistry {
  private functions = new Map<string, FunctionDefinition>();

  register(definition: FunctionDefinition): void {
    // Validate UAX #31 for name? Can be done in CatalogRegistry instead.
    this.functions.set(definition.name, definition);
  }

  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name);
  }

  execute(
    name: string,
    args: Record<string, any>,
    context: { dataModel: Record<string, unknown> },
  ): any {
    const fn = this.functions.get(name);
    if (!fn) {
      throw new Error(`INVALID_FUNCTION_CALL: Unregistered function ${name}`);
    }
    return fn.evaluate(args, context);
  }
}

// Global default registry
export const globalFunctionRegistry = new FunctionRegistry();
