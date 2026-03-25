/**
 * HydrationService
 *
 * Coordinates refreshing vector indexes (dialog contracts + R signatures)
 * based on the user's chosen hydration mode setting.
 *
 * - 'on-launch':    Called at app startup (AppComponent init)
 * - 'on-ai-panel':  Called when the AI assist panel opens for the first time
 * - 'disabled':     Never auto-called; user must trigger manually
 */

import { Injectable, inject } from '@angular/core';
import { AIConfigService, type HydrationMode } from '../services/ai-config.service';
import { VectorIndexService } from './vector-index.service';
import { IPC_BRIDGE } from '../ai/ipc/ipc-bridge';

@Injectable({ providedIn: 'root' })
export class HydrationService {
  private readonly aiConfig = inject(AIConfigService);
  private readonly vectorIndex = inject(VectorIndexService);
  private readonly ipc = inject(IPC_BRIDGE);

  private _hasHydrated = false;
  private _hydrating = false;

  get hasHydrated(): boolean {
    return this._hasHydrated;
  }

  /**
   * Attempt hydration if the current mode matches the given trigger.
   * Safe to call multiple times — only runs once per session.
   */
  async hydrateIfNeeded(trigger: 'on-launch' | 'on-ai-panel'): Promise<void> {
    if (this._hasHydrated || this._hydrating) return;

    const mode: HydrationMode = this.aiConfig.hydrationMode();
    if (mode === 'disabled') return;
    if (mode !== trigger) return;

    await this.hydrate();
  }

  /**
   * Force a full hydration regardless of mode. Used for manual refresh.
   */
  async hydrate(): Promise<void> {
    if (this._hydrating) return;
    this._hydrating = true;

    try {
      // Index dialog contracts (renderer-side, via VectorIndexService)
      await this.vectorIndex.indexDialogContracts();

      // Trigger R signature re-indexing (main process)
      if (this.ipc.isVectorAvailable()) {
        try {
          await window.electronAPI?.vector?.hydrateRSignatures?.();
        } catch {
          // Non-fatal — R may not be ready yet
        }
      }

      this._hasHydrated = true;
    } finally {
      this._hydrating = false;
    }
  }
}
