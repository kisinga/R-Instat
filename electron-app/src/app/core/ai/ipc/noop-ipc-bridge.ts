import type { IPCBridge, AIProxyResponse } from './ipc-bridge';

/**
 * No-op IPC bridge for testing. Returns configurable canned responses.
 */
export class NoopIPCBridge implements IPCBridge {
  /** Override to provide custom AI responses in tests. */
  aiResponse: AIProxyResponse = { ok: true, status: 200, data: {} };

  isAiAvailable(): boolean {
    return true;
  }

  async anthropicMessage(): Promise<AIProxyResponse> {
    return this.aiResponse;
  }

  async openaiChat(): Promise<AIProxyResponse> {
    return this.aiResponse;
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
