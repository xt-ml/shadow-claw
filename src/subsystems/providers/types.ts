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

export interface ActiveLoadWaiter {
  onProgress: (payload: any) => void;
  reject: (reason: any) => void;
  resolve: () => void;
}

export interface ActiveLoadState {
  key: string;
  lastProgress: any | null;
  waiters: ActiveLoadWaiter[];
}
