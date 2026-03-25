import { InjectionToken } from '@angular/core';

// Re-declare the Electron IPC types locally so we don't depend on global ambient declarations.
// These mirror the shapes in electron.d.ts but are owned by the bridge abstraction.

export interface AnthropicMessageRequest {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}

export interface OpenAIChatRequest {
  apiKey: string;
  system: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  timeoutMs?: number;
}

export interface VectorDialogContract {
  dialogId: string;
  description: string;
  family: string;
  operations: string[];
  keywords: string[];
  paramNames: string[];
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface VectorInteractionRecord {
  id: string;
  query: string;
  dialogId: string;
  operationId?: string;
  state: string;
  success: boolean;
  executionMode?: string;
  confidence?: number;
}

export interface AIProxyResponse {
  ok: boolean;
  status: number;
  data: unknown;
}

export interface IPCBridge {
  // AI provider calls
  isAiAvailable(): boolean;
  anthropicMessage(request: AnthropicMessageRequest): Promise<AIProxyResponse>;
  openaiChat(request: OpenAIChatRequest): Promise<AIProxyResponse>;

  // Vector operations
  isVectorAvailable(): boolean;
  vectorStatus(): Promise<{ embedding: unknown; vectorStore: unknown }>;
  vectorIndexDialogs(contracts: VectorDialogContract[]): Promise<{ indexed: number }>;
  vectorSearchDialogs(query: string, topK: number, family?: string): Promise<VectorSearchResult[]>;
  vectorStoreInteraction(record: VectorInteractionRecord): Promise<{ stored: boolean }>;
  vectorSearchInteractions(query: string, topK: number): Promise<VectorSearchResult[]>;
  vectorSearchRSignatures(query: string, topK: number): Promise<VectorSearchResult[]>;
  vectorTableInfo(table: string): Promise<{ exists: boolean; rowCount: number }>;
}

export const IPC_BRIDGE = new InjectionToken<IPCBridge>('IPC_BRIDGE');
