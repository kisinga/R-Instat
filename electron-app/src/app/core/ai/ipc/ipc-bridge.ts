import { InjectionToken } from '@angular/core';

export interface StructuredPlanRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface StructuredPlanResult {
  ok: boolean;
  plan?: unknown;
  error?: string;
}

export interface RawChatRequest {
  provider: 'openai' | 'claude';
  apiKey: string;
  systemPrompt: string;
  userMessage: string;
  responseFormat: 'json' | 'text';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface RawChatResult {
  ok: boolean;
  content?: string;
  error?: string;
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

export interface IPCBridge {
  // AI calls
  isAiAvailable(): boolean;
  structuredPlan(request: StructuredPlanRequest): Promise<StructuredPlanResult>;
  rawChat(request: RawChatRequest): Promise<RawChatResult>;

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
