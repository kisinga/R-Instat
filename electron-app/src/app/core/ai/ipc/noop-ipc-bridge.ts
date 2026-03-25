import type {
  IPCBridge,
  StructuredPlanResult,
  RawChatResult,
  VectorSearchResult,
} from './ipc-bridge';

/**
 * No-op IPC bridge for testing. Returns configurable canned responses.
 */
export class NoopIPCBridge implements IPCBridge {
  structuredPlanResponse: StructuredPlanResult = { ok: false, error: 'NoopIPCBridge' };
  rawChatResponse: RawChatResult = { ok: false, error: 'NoopIPCBridge' };

  isAiAvailable(): boolean {
    return true;
  }

  async structuredPlan(): Promise<StructuredPlanResult> {
    return this.structuredPlanResponse;
  }

  async rawChat(): Promise<RawChatResult> {
    return this.rawChatResponse;
  }

  isVectorAvailable(): boolean {
    return false;
  }

  async vectorStatus(): Promise<{ embedding: unknown; vectorStore: unknown }> {
    return { embedding: { status: 'unavailable' }, vectorStore: { status: 'unavailable' } };
  }

  async vectorIndexDialogs(): Promise<{ indexed: number }> {
    return { indexed: 0 };
  }

  async vectorSearchDialogs(): Promise<VectorSearchResult[]> {
    return [];
  }

  async vectorStoreInteraction(): Promise<{ stored: boolean }> {
    return { stored: false };
  }

  async vectorSearchInteractions(): Promise<VectorSearchResult[]> {
    return [];
  }

  async vectorSearchRSignatures(): Promise<VectorSearchResult[]> {
    return [];
  }

  async vectorTableInfo(): Promise<{ exists: boolean; rowCount: number }> {
    return { exists: false, rowCount: 0 };
  }
}
