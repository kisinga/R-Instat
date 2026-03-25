import { Injectable } from '@angular/core';
import type {
  IPCBridge,
  StructuredPlanRequest,
  StructuredPlanResult,
  RawChatRequest,
  RawChatResult,
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

  async structuredPlan(request: StructuredPlanRequest): Promise<StructuredPlanResult> {
    if (!window.electronAPI?.ai?.structuredPlan) {
      throw new Error('AI requires Electron IPC bridge. Restart the Electron app.');
    }
    return window.electronAPI.ai.structuredPlan(request);
  }

  async rawChat(request: RawChatRequest): Promise<RawChatResult> {
    if (!window.electronAPI?.ai?.rawChat) {
      throw new Error('AI requires Electron IPC bridge. Restart the Electron app.');
    }
    return window.electronAPI.ai.rawChat(request);
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
