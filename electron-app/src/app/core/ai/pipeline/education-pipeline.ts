/**
 * Education Pipeline — thin wrapper over PipelineOrchestrator.
 *
 * Stages: PiiGuard → ValidateKey → EducationLlmCall
 * All orchestration logic lives in PipelineOrchestrator.
 */

import { Injectable, inject } from '@angular/core';
import type { PipelineInputs, ConversationTurn } from './context';
import type { PipelineStage } from './stage';
import { PipelineOrchestrator } from './pipeline-orchestrator';
import type { DataContext } from '../types/data-context.types';
import type { EducationAIResponse } from '../../models/chat.model';
import { AIConfigService } from '../../services/ai-config.service';

import { PiiGuardStage } from './stages/pii-guard.stage';
import { ValidateKeyStage } from './stages/validate-key.stage';
import { EducationLlmCallStage } from './stages/education-llm-call.stage';

export interface EducationPipelineResult {
  success: boolean;
  response?: EducationAIResponse;
  error?: string;
  warnings?: string[];
}

@Injectable({ providedIn: 'root' })
export class EducationPipeline {
  private readonly orchestrator = inject(PipelineOrchestrator);
  private readonly aiConfig = inject(AIConfigService);

  private readonly stages: PipelineStage[] = [
    inject(PiiGuardStage),
    inject(ValidateKeyStage),
    inject(EducationLlmCallStage),
  ];

  async execute(
    userInput: string,
    dataContext: DataContext,
    history?: ConversationTurn[],
    options?: { signal?: AbortSignal }
  ): Promise<EducationPipelineResult> {
    const inputs: PipelineInputs = {
      userInput,
      dataContext,
      conversationHistory: history ?? [],
      signal: options?.signal,
      verbose: this.aiConfig.verboseAiDiagnostics(),
    };

    return this.orchestrator.execute<EducationPipelineResult>(inputs, {
      label: 'Education',
      stages: this.stages,
      resultMapper: (state, diagnostics) => {
        if (!state.educationResponse) {
          return { success: false, error: 'No response from AI.' };
        }
        return {
          success: true,
          response: state.educationResponse,
          warnings: diagnostics.warnings.length > 0 ? diagnostics.warnings : undefined,
        };
      },
    });
  }
}
