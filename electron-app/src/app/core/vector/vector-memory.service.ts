/**
 * VectorMemoryService
 *
 * Stores and retrieves past AI interactions for few-shot learning.
 * Completely optional - consumers check isReady() before use.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { IPC_BRIDGE } from '../ai/ipc/ipc-bridge';

export interface PastInteraction {
  query: string;
  dialogId: string;
  operationId: string;
  state: Record<string, unknown>;
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class VectorMemoryService {
  private readonly ipc = inject(IPC_BRIDGE);
  private readonly _ready = signal(false);
  readonly isReady = computed(() => this._ready());

  constructor() {
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    if (!this.ipc.isVectorAvailable()) return;
    try {
      const status = await this.ipc.vectorStatus();
      const vsStatus = status.vectorStore as { status?: string } | undefined;
      if (vsStatus?.status === 'ready') {
        this._ready.set(true);
      }
    } catch {
      // Vector services not available - that's fine
    }
  }

  /**
   * Record a completed AI interaction for future retrieval.
   */
  async recordInteraction(
    query: string,
    dialogId: string,
    operationId: string,
    state: Record<string, unknown>,
    success: boolean,
    executionMode?: string,
    confidence?: number
  ): Promise<void> {
    if (!this.ipc.isVectorAvailable()) return;

    try {
      await this.ipc.vectorStoreInteraction({
        id: crypto.randomUUID(),
        query,
        dialogId,
        operationId,
        state: JSON.stringify(state),
        success,
        executionMode,
        confidence,
      });
      this._ready.set(true);
    } catch {
      // Non-fatal - memory is optional
    }
  }

  /**
   * Retrieve similar past successful interactions.
   * Returns empty array if service is unavailable.
   */
  async getSimilarInteractions(query: string, topK = 3): Promise<PastInteraction[]> {
    if (!this.ipc.isVectorAvailable()) return [];

    try {
      const results = await this.ipc.vectorSearchInteractions(query, topK);

      return results.map(r => ({
        query: String(r.metadata['query'] ?? ''),
        dialogId: String(r.metadata['dialogId'] ?? ''),
        operationId: String(r.metadata['operationId'] ?? ''),
        state: this.parseState(r.metadata['state']),
        confidence: Number(r.metadata['confidence'] ?? 0),
      }));
    } catch {
      return [];
    }
  }

  private parseState(raw: unknown): Record<string, unknown> {
    if (typeof raw !== 'string') return {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
