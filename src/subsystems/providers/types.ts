export interface LLMProvider {
  apiKeyHeader?: string;
  apiKeyHeaderFormat?: string;
  headers?: Record<string, string>;
  id: string;
  models?: string[];
  modelsUrl?: string;
  name: string;
  requiresApiKey?: boolean;
}
