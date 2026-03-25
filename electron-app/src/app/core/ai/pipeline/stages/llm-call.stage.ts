import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';
import { LLMProviderFactory } from '../../providers/llm-provider.factory';
import { PLANNER_SYSTEM_PROMPT, DIRECT_R_SYSTEM_PROMPT } from '../../prompt/system-prompt';
import { buildDirectRPrompt } from '../../prompt/prompt-builder';
import { deAliasScript } from '../../pii-guard';
import type { AIPlan } from '../../types/ai-plan.types';
import type { LLMProvider } from '../../providers/llm-provider';
import type { LLMModelConfig } from '../../../services/ai-config.service';

@Injectable({ providedIn: 'root' })
export class LlmCallStage implements PipelineStage {
  readonly id = 'llm-call';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly llmFactory = inject(LLMProviderFactory);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const provider = this.llmFactory.getProvider();
    const modelConfig = this.aiConfig.modelConfig();

    if (ctx.state.modeDecision!.mode === 'direct_r') {
      return this.handleDirectR(ctx, provider, modelConfig);
    }

    // Standard planner call
    const response = await provider.call(ctx.state.apiKey!, {
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userMessage: ctx.state.userMessage!,
      responseFormat: 'json',
      model: modelConfig.plannerModel,
      temperature: modelConfig.plannerTemperature,
      maxTokens: modelConfig.plannerMaxTokens,
    });

    ctx.state.llmResponse = response.content;
    return Stage.continue();
  }

  private async handleDirectR(
    ctx: PipelineContext,
    provider: LLMProvider,
    modelConfig: LLMModelConfig
  ): Promise<StageResult> {
    const prompt = buildDirectRPrompt(ctx.state.aliasedInput!, ctx.state.aliasedContext!);

    const response = await provider.call(ctx.state.apiKey!, {
      systemPrompt: DIRECT_R_SYSTEM_PROMPT,
      userMessage: prompt,
      responseFormat: 'text',
      model: modelConfig.codegenModel,
      temperature: modelConfig.codegenTemperature,
      maxTokens: modelConfig.codegenMaxTokens,
    });

    const script = deAliasScript(response.content.trim(), ctx.state.aliasMaps!);

    const plan: AIPlan = {
      goal: ctx.inputs.userInput,
      assumptions: ['Direct script generated for uncovered or advanced intent.'],
      clarificationQuestions: [],
      overallConfidence: 0.68,
      requiresConfirmation: true,
      executionMode: 'direct_r',
      modeReason: ctx.state.modeDecision!.reason,
      modeConfidence: ctx.state.modeDecision!.confidence,
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

    return Stage.terminate({
      success: true,
      plan,
      retrievalReport: ctx.state.retrievalReport,
      privacyReport: ctx.state.privacyReport,
    });
  }
}
