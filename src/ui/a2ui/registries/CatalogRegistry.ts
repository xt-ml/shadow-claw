// UAX #31 Identifier Validation (Simplified for JS string/regex limits)
// Validates that an identifier starts with a letter or underscore,
// followed by letters, numbers, or underscores.
export function isValidUAX31Identifier(id: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id);
}

export interface CatalogDefinition {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  surfaceProperties?: Record<string, unknown>;
  functions?: Record<string, any>; // Schema for functions
  components?: Record<string, any>; // Schema for components (implied)
  instructions?: string;
}

export class CatalogRegistry {
  private catalogs = new Map<string, CatalogDefinition>();

  register(catalogId: string, definition: CatalogDefinition): void {
    if (!catalogId) {
      throw new Error("Catalog ID is required");
    }

    // Validate UAX #31 for function names if present
    if (definition.functions) {
      for (const funcName of Object.keys(definition.functions)) {
        if (!isValidUAX31Identifier(funcName)) {
          console.warn(
            `[CatalogRegistry] Function name "${funcName}" does not conform to UAX #31`,
          );
        }

        // In a full implementation, this would parse the schema and extract callableFrom.
        // For now, we assume this is done elsewhere or we just store the definition.
      }
    }

    this.catalogs.set(catalogId, definition);
  }

  get(catalogId: string): CatalogDefinition | undefined {
    return this.catalogs.get(catalogId);
  }
}

export const globalCatalogRegistry = new CatalogRegistry();
