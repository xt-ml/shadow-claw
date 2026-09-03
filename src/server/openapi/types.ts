/**
 * OpenAPI 3.1.0 TypeScript Definitions
 * Lightweight, strictly typed schema definitions for ShadowClaw's API specification.
 */

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
  license?: {
    name: string;
    url?: string;
  };
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
}

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiTag {
  name: string;
  description?: string;
}

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: Record<string, unknown>;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content: {
    [mediaType: string]: {
      schema: Record<string, unknown>;
      example?: unknown;
    };
  };
}

export interface OpenApiResponse {
  description: string;
  content?: {
    [mediaType: string]: {
      schema?: Record<string, unknown>;
      example?: unknown;
    };
  };
  headers?: Record<string, unknown>;
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: {
    [statusCode: string]: OpenApiResponse;
  };
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface OpenApiPathItem {
  summary?: string;
  description?: string;
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  parameters?: OpenApiParameter[];
}

export interface OpenApiSecurityScheme {
  type: "apiKey" | "http" | "oauth2" | "openIdConnect";
  description?: string;
  name?: string;
  in?: "header" | "query" | "cookie";
  scheme?: string;
  bearerFormat?: string;
}

export interface OpenApiComponents {
  schemas?: Record<string, Record<string, unknown>>;
  securitySchemes?: Record<string, OpenApiSecurityScheme>;
}

export interface OpenApiSpec {
  openapi: "3.1.0";
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  tags?: OpenApiTag[];
  paths: Record<string, OpenApiPathItem>;
  components?: OpenApiComponents;
}
