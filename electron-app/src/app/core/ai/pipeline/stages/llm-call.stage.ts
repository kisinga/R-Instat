import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { AIConfigService } from '../../../services/ai-config.service';
import { LLMProviderFactory } from '../../providers/llm-provider.factory';
import { PLANNER_SYSTEM_PROMPT, DIRECT_R_SYSTEM_PROMPT } from '../../prompt/system-prompt';
import { buildDirectRPrompt } from '../../prompt/prompt-builder';
import { deAliasScript } from '../../pii-guard';
import type { AIPlan } from '../../types/ai-plan.types';

@Injectable({ providedIn: 'root' })
export class LlmCallStage implements PipelineStage {
  readonly id = 'llm-call';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly llmFactory = inject(LLMProviderFactory);

  async execute(ctx: PipelineContext): Promise<boolean> {
    const provider = this.llmFactory.getProvider();
    const modelConfig = this.aiConfig.modelConfig();

    if (ctx.modeDecision!.mode === 'direct_r') {
      return this.handleDirectR(ctx, provider, modelConfig);
    }

    // Standard planner call
    const response = await provider.call(ctx.apiKey!, {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userMessage: ctx.userMessage!,
      responseFormat: 'json',
      model: modelConfig.plannerModel,
      temperature: modelConfig.plannerTemperature,
      maxTokens: modelConfig.plannerMaxTokens,
    });

    ctx.llmResponse = response.content;
    return true;
  }

  private async handleDirectR(
    ctx: PipelineContext,
    provider: import('../../providers/llm-provider').LLMProvider,
    modelConfig: import('../../../services/ai-config.service').LLMModelConfig
  ): Promise<boolean> {
    const prompt = buildDirectRPrompt(ctx.aliasedInput!, ctx.aliasedContext!);

    const response = await provider.call(ctx.apiKey!, {
      systemPrompt: DIRECT_R_SYSTEM_PROMPT,
      userMessage: prompt,
      responseFormat: 'text',
      model: modelConfig.codegenModel,
      temperature: modelConfig.codegenTemperature,
      maxTokens: modelConfig.codegenMaxTokens,
    });

    const script = deAliasScript(response.content.trim(), ctx.aliasMaps!);

    const plan: AIPlan = {
      goal: ctx.rawUserInput,
      assumptions: ['Direct script generated for uncovered or advanced intent.'],
      clarificationQuestions: [],
      overallConfidence: 0.68,
      requiresConfirmation: true,
      executionMode: 'direct_r',
      modeReason: ctx.modeDecision!.reason,
      modeConfidence: ctx.modeDecision!.confidence,
      steps: [
        {
          stepType: 'code',
          stepId: 'direct-r-1',
          executionMode: 'direct_r',
          script,
          expectedOutputs: ['R console output and/or generated objects'],
          safetyFlags: ['requires_review', 'llm_direct'],
          inferredFields: ['script'],
          confidence: 0.68,
          rationale: 'Direct R generated for capability gap.',
        },
      ],
    };

    ctx.earlyResult = {
      success: true,
      plan,
      retrievalReport: ctx.retrievalReport,
      privacyReport: ctx.privacyReport,
    };
    return false;
  }
}
