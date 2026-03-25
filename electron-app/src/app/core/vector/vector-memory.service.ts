/**
 * VectorMemoryService
 *
 * Stores and retrieves past AI interactions for few-shot learning.
 * Completely optional - consumers check isReady() before use.
 */

import { Injectable, signal, computed } from '@angular/core';

export interface PastInteraction {
  query: string;
  dialogId: string;
  operationId: string;
  state: Record<string, unknown>;
  confidence: number;
}

@Injectable({ providedIn: 'root' })
export class VectorMemoryService {
  private readonly _ready = signal(false);
  readonly isReady = computed(() => this._ready());

  constructor() {
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    if (!window.electronAPI?.vector) return;
    try {
      const status = await window.electronAPI.vector.status();
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
    if (!window.electronAPI?.vector) return;

    try {
      await window.electronAPI.vector.storeInteraction({
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
    if (!window.electronAPI?.vector) return [];

    try {
      const results = await window.electronAPI.vector.searchInteractions(query, topK);

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
