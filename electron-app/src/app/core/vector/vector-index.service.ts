/**
 * VectorIndexService
 *
 * Angular service that indexes dialog contracts into the vector store
 * and provides semantic search over them. Auto-discovers contracts from
 * the existing catalog aggregator - no dialog changes required.
 *
 * Fully optional: all consumers check isReady() before use.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { getDialogContractsForPrompt } from '../ai/dialog-catalog-aggregator';
import type { DialogPromptContract } from '../ai/dialog-catalog';
import { IPC_BRIDGE, type IPCBridge } from '../ai/ipc/ipc-bridge';

export interface PreRankedCandidate {
  dialogId: string;
  score: number;
  reasons: string[];
}

export type VectorStatus = 'idle' | 'indexing' | 'ready' | 'unavailable' | 'error';

@Injectable({ providedIn: 'root' })
export class VectorIndexService {
  private readonly ipc = inject(IPC_BRIDGE);
  private readonly _status = signal<VectorStatus>('idle');
  private readonly _error = signal<string | null>(null);
  private _indexedHash: string | null = null;

  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isReady = computed(() => this._status() === 'ready');

  /**
   * Index all dialog contracts from the catalog.
   * Skips re-indexing if the catalog hasn't changed (hash check).
   * Safe to call multiple times.
   */
  async indexDialogContracts(): Promise<void> {
    if (!this.ipc.isVectorAvailable()) {
      this._status.set('unavailable');
      return;
    }

    const contracts = getDialogContractsForPrompt();
    const hash = this.hashContracts(contracts);

    if (hash === this._indexedHash && this._status() === 'ready') {
      return; // Already indexed, catalog unchanged
    }

    this._status.set('indexing');

    try {
      const indexData = contracts.map(c => ({
        dialogId: c.dialogId,
        description: c.description,
        family: c.family,
        operations: c.operations,
        keywords: c.retrievalHints.keywords,
        paramNames: c.params.map(p => p.name),
      }));

      await this.ipc.vectorIndexDialogs(indexData);
      this._indexedHash = hash;
      this._status.set('ready');
      this._error.set(null);
    } catch (err) {
      this._error.set(err instanceof Error ? err.message : String(err));
      this._status.set('error');
    }
  }

  /**
   * Search for dialogs semantically similar to the query.
   * Returns pre-ranked candidates that can be passed to the existing retriever.
   */
  async preRankDialogs(
    query: string,
    topK: number,
    family?: string
  ): Promise<PreRankedCandidate[]> {
    if (!this.ipc.isVectorAvailable() || this._status() !== 'ready') {
      return [];
    }

    try {
      const results = await this.ipc.vectorSearchDialogs(query, topK, family);

      return results.map(r => ({
        dialogId: r.id,
        score: r.score,
        reasons: [`vector similarity: ${r.score.toFixed(3)}`],
      }));
    } catch {
      return [];
    }
  }

  /**
   * Ensure index is built. Call this lazily on first AI-assist use.
   */
  async ensureIndexed(): Promise<void> {
    if (this._status() === 'ready') return;
    if (this._status() === 'indexing') return; // Already in progress
    await this.indexDialogContracts();
  }

  private hashContracts(contracts: DialogPromptContract[]): string {
    // Simple hash: concatenate dialogIds + descriptions, hash to string
    const content = contracts
      .map(c => `${c.dialogId}:${c.description}:${c.operations.join(',')}`)
      .join('|');
    // Simple string hash (FNV-1a)
    let hash = 0x811c9dc5;
    for (let i = 0; i < content.length; i++) {
      hash ^= content.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0;
    }
    return hash.toString(36);
  }
}
