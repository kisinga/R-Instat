import { Injectable } from '@angular/core';
import type {
  IPCBridge,
  AIProxyResponse,
  AnthropicMessageRequest,
  OpenAIChatRequest,
  VectorDialogContract,
  VectorSearchResult,
  VectorInteractionRecord,
} from './ipc-bridge';

@Injectable({ providedIn: 'root' })
export class ElectronIPCBridge implements IPCBridge {
  // ── AI ──

  isAiAvailable(): boolean {
    return !!window.electronAPI?.ai;
  }

  async anthropicMessage(request: AnthropicMessageRequest): Promise<AIProxyResponse> {
    if (!window.electronAPI?.ai?.anthropicMessage) {
      throw new Error(
        'Claude requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }
    return window.electronAPI.ai.anthropicMessage(request);
  }

  async openaiChat(request: OpenAIChatRequest): Promise<AIProxyResponse> {
    if (!window.electronAPI?.ai?.openaiChat) {
      throw new Error(
        'OpenAI requires Electron IPC bridge. Restart the Electron app and open AI Assist inside the Electron window.'
      );
    }
    return window.electronAPI.ai.openaiChat(request);
  }

  // ── Vector ──

  isVectorAvailable(): boolean {
    return !!window.electronAPI?.vector;
  }

  async vectorStatus(): Promise<{ embedding: unknown; vectorStore: unknown }> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.status();
  }

  async vectorIndexDialogs(contracts: VectorDialogContract[]): Promise<{ indexed: number }> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.indexDialogs(contracts);
  }

  async vectorSearchDialogs(query: string, topK: number, family?: string): Promise<VectorSearchResult[]> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.searchDialogs(query, topK, family);
  }

  async vectorStoreInteraction(record: VectorInteractionRecord): Promise<{ stored: boolean }> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.storeInteraction(record);
  }

  async vectorSearchInteractions(query: string, topK: number): Promise<VectorSearchResult[]> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.searchInteractions(query, topK);
  }

  async vectorSearchRSignatures(query: string, topK: number): Promise<VectorSearchResult[]> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.searchRSignatures(query, topK);
  }

  async vectorTableInfo(table: string): Promise<{ exists: boolean; rowCount: number }> {
    if (!window.electronAPI?.vector) throw new Error('Vector IPC unavailable');
    return window.electronAPI.vector.tableInfo(table);
  }
}
