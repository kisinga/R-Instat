/**
 * Current-dialogue registry: holds the single "current" dialogue registration for AI.
 * Consumes DialogueAIContract only; no DialogBase or app dependencies.
 * See core/ai/docs/ai-integration.md for flow and usage.
 */

import { Injectable } from '@angular/core';
import type { DialogueAIContract, DialogueAIDescriptor, DialogueAIContext } from './current-dialogue-contract';

interface CurrentRegistration {
  dialogId: string;
  contract: DialogueAIContract;
}

@Injectable({ providedIn: 'root' })
export class CurrentDialogueRegistryService {
  private current: CurrentRegistration | null = null;

  register(dialogId: string, contract: DialogueAIContract): void {
    this.current = { dialogId, contract };
    const name = contract.getDescriptor()?.name;
    if (typeof console !== 'undefined' && console.info) {
      console.info(`[AI Registry] Registered: ${dialogId}${name ? ` (${name})` : ''}`);
    }
  }

  unregister(dialogId: string): void {
    if (this.current?.dialogId === dialogId) {
      this.current = null;
      if (typeof console !== 'undefined' && console.info) {
        console.info(`[AI Registry] Unregistered: ${dialogId}. No current dialog.`);
      }
    }
  }

  getCurrentDescriptor(): DialogueAIDescriptor | null {
    return this.current?.contract.getDescriptor() ?? null;
  }

  getCurrentContext(): DialogueAIContext | null {
    return this.current?.contract.getContext() ?? null;
  }

  hasCurrent(): boolean {
    return this.current !== null;
  }
}
