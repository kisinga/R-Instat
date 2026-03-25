/**
 * AI Pipeline — thin wrapper over PipelineOrchestrator.
 *
 * Composes the action-planning stage sequence and result mapper.
 * All orchestration logic lives in PipelineOrchestrator.
 */

import { Injectable, inject } from '@angular/core';
import type { PipelineInputs } from './context';
import type { PipelineStage } from './stage';
import { PipelineOrchestrator } from './pipeline-orchestrator';
import type { AICallResult } from '../types/ai-result.types';
import type { DataContext } from '../types/data-context.types';
import type { ConversationTurn } from './context';
import { AIConfigService } from '../../services/ai-config.service';

import { PiiGuardStage } from './stages/pii-guard.stage';
import { CategorizeStage } from './stages/categorize.stage';
import { VectorPreRankStage } from './stages/vector-prerank.stage';
import { ScopeStage } from './stages/scope.stage';
import { RecipeInterceptStage } from './stages/recipe-intercept.stage';
import { ValidateKeyStage } from './stages/validate-key.stage';
import { LlmCallStage } from './stages/llm-call.stage';
import { DealiasStage } from './stages/dealias.stage';
import { PostGuardsStage } from './stages/post-guards.stage';
import { MemoryRecordStage } from './stages/memory-record.stage';

@Injectable({ providedIn: 'root' })
export class AIPipeline {
  private readonly orchestrator = inject(PipelineOrchestrator);
  private readonly aiConfig = inject(AIConfigService);

  private readonly stages: PipelineStage[] = [
    inject(PiiGuardStage),
    inject(CategorizeStage),
    inject(VectorPreRankStage),
    inject(ScopeStage),
    inject(RecipeInterceptStage),
    inject(ValidateKeyStage),
    inject(LlmCallStage),
    inject(DealiasStage),
    inject(PostGuardsStage),
    inject(MemoryRecordStage),
  ];

  async execute(
    userInput: string,
    dataContext: DataContext,
    options?: { signal?: AbortSignal; conversationHistory?: ConversationTurn[] }
  ): Promise<AICallResult> {
    const inputs: PipelineInputs = {
      userInput,
      dataContext,
      conversationHistory: options?.conversationHistory ?? [],
      signal: options?.signal,
      verbose: this.aiConfig.verboseAiDiagnostics(),
    };

    return this.orchestrator.execute<AICallResult>(inputs, {
      label: 'AI',
      stages: this.stages,
      resultMapper: (state, _diagnostics) => ({
        success: true,
        plan: state.finalPlan,
        retrievalReport: state.retrievalReport,
        privacyReport: state.privacyReport,
      }),
    });
  }
}
