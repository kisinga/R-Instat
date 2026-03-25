/**
 * VectorRContextService
 *
 * Retrieves relevant R function signatures from the vector store
 * to enrich the direct_r code generation prompt.
 * Completely optional - consumers check isReady() before use.
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { IPC_BRIDGE } from '../ai/ipc/ipc-bridge';

export interface RSignature {
  functionName: string;
  package: string;
  signature: string;
  paramNames: string;
}

@Injectable({ providedIn: 'root' })
export class VectorRContextService {
  private readonly ipc = inject(IPC_BRIDGE);
  private readonly _ready = signal(false);
  readonly isReady = computed(() => this._ready());

  constructor() {
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    if (!this.ipc.isVectorAvailable()) return;
    try {
      const info = await this.ipc.vectorTableInfo('r_signatures');
      if (info.exists && info.rowCount > 0) {
        this._ready.set(true);
      }
    } catch {
      // R signatures not indexed yet - that's fine
    }
  }

  /**
   * Search for R functions relevant to a query.
   * Returns empty array if service unavailable or no signatures indexed.
   */
  async getRelevantSignatures(query: string, topK = 8): Promise<RSignature[]> {
    if (!this.ipc.isVectorAvailable() || !this._ready()) return [];

    try {
      const results = await this.ipc.vectorSearchRSignatures(query, topK);

      return results.map(r => ({
        functionName: String(r.metadata['functionName'] ?? r.id),
        package: String(r.metadata['package'] ?? ''),
        signature: String(r.metadata['signature'] ?? ''),
        paramNames: String(r.metadata['paramNames'] ?? ''),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Format signatures for inclusion in an LLM prompt.
   */
  formatForPrompt(signatures: RSignature[]): string {
    if (signatures.length === 0) return '';

    const lines = signatures.map(s =>
      `- ${s.signature} [${s.package}]`
    );

    return `Available R functions (use these when applicable):\n${lines.join('\n')}`;
  }

  /**
   * Re-check availability (call after R signature indexing completes).
   */
  async refresh(): Promise<void> {
    await this.checkAvailability();
  }
}
