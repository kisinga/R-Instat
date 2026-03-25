/**
 * Layer 2 – Scoper: Given category (and optional family), produce contract set and
 * optional current-dialogue context. Uses CurrentDialogueRegistry for refine path;
 * uses dialog-context-retriever for open_dialog (optionally family-scoped).
 * See core/ai/docs/ai-integration.md for flow and behaviour by category.
 */

import { Injectable, inject } from '@angular/core';
import type { DialogPromptContract, DialogFamily } from './dialog-catalog';
import type { DialogueAIContext } from './current-dialogue-contract';
import type { PromptCategory } from './pipeline-types';
import { CurrentDialogueRegistryService } from './current-dialogue-registry.service';
import { getDialogContractsForPrompt } from './dialog-identity.registry';
import {
  retrieveDialogContractsTopK,
  type RetrievalDataContext,
  type PreRankedCandidate,
} from './dialog-context-retriever';

export type ExecutionMode = 'component_codegen' | 'structured_codegen' | 'direct_r';

export interface ScopedPromptContext {
  contracts: DialogPromptContract[];
  currentDialogContext: DialogueAIContext | null;
  executionMode: ExecutionMode;
}

const DEFAULT_TOP_K = 5;

@Injectable({ providedIn: 'root' })
export class PromptScoperService {
  private readonly registry = inject(CurrentDialogueRegistryService);

  /**
   * Produce contract set and optional current-dialogue context for the planner.
   */
  /**
   * Produce contract set and optional current-dialogue context for the planner.
   * Accepts optional preRankedCandidates from vector search (caller pre-fetches async).
   */
  scope(
    category: PromptCategory,
    family: DialogFamily | undefined,
    userInput: string,
    dataContext: RetrievalDataContext,
    topK: number = DEFAULT_TOP_K,
    preRankedCandidates?: PreRankedCandidate[]
  ): ScopedPromptContext {
    switch (category) {
      case 'refine_current_dialog': {
        const descriptor = this.registry.getCurrentDescriptor();
        const currentContext = this.registry.getCurrentContext();
        if (!descriptor || !currentContext) {
          return this.scopeOpenDialog(userInput, family, dataContext, topK, preRankedCandidates);
        }
        const allContracts = getDialogContractsForPrompt();
        const contract = allContracts.find((c) => c.dialogId === descriptor.id);
        const contracts: DialogPromptContract[] = contract ? [contract] : [];
        return {
          contracts,
          currentDialogContext: currentContext,
          executionMode: 'component_codegen',
        };
      }

      case 'open_dialog':
        return this.scopeOpenDialog(userInput, family, dataContext, topK, preRankedCandidates);

      case 'run_code':
        return {
          contracts: [],
          currentDialogContext: null,
          executionMode: 'direct_r',
        };

      case 'education_question':
        return {
          contracts: [],
          currentDialogContext: this.registry.getCurrentContext(),
          executionMode: 'component_codegen',
        };

      case 'data_quality_recipe':
        return {
          contracts: [],
          currentDialogContext: null,
          executionMode: 'component_codegen',
        };

      default:
        return this.scopeOpenDialog(userInput, undefined, dataContext, topK, preRankedCandidates);
    }
  }

  private scopeOpenDialog(
    userInput: string,
    family: DialogFamily | undefined,
    dataContext: RetrievalDataContext,
    topK: number,
    preRankedCandidates?: PreRankedCandidate[]
  ): ScopedPromptContext {
    const allContracts = getDialogContractsForPrompt();
    const candidates = retrieveDialogContractsTopK(
      userInput,
      allContracts,
      dataContext,
      topK,
      family,
      preRankedCandidates
    );
    const contracts =
      candidates.length > 0
        ? candidates.map(({ score: _s, reasons: _r, ...c }) => c)
        : (family
            ? allContracts.filter((c) => c.family === family)
            : allContracts).slice(0, topK);
    return {
      contracts,
      currentDialogContext: null,
      executionMode: 'component_codegen',
    };
  }
}
