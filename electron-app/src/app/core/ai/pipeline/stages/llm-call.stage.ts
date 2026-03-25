import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { AIConfigService } from '../../../services/ai-config.service';
import { LLMProviderFactory } from '../../providers/llm-provider.factory';
import { IPC_BRIDGE } from '../../ipc/ipc-bridge';
import { PLANNER_SYSTEM_PROMPT, DIRECT_R_SYSTEM_PROMPT } from '../../prompt/system-prompt';
import { buildDirectRPrompt } from '../../prompt/prompt-builder';
import { deAliasScript } from '../../pii-guard';
import { isValidOperationId } from '../../shared/operation-validator';
import type { AIPlan, AIDialogPlanStep, AIPlanStep, ClarificationItem } from '../../types/ai-plan.types';
import type { LLMProvider } from '../../providers/llm-provider';
import type { LLMModelConfig } from '../../../services/ai-config.service';

@Injectable({ providedIn: 'root' })
export class LlmCallStage implements PipelineStage {
  readonly id = 'llm-call';
  readonly errorPolicy = 'fatal' as const;

  private readonly aiConfig = inject(AIConfigService);
  private readonly llmFactory = inject(LLMProviderFactory);
  private readonly ipc = inject(IPC_BRIDGE);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const modelConfig = this.aiConfig.modelConfig();

    if (ctx.state.modeDecision!.mode === 'direct_r') {
      return this.handleDirectR(ctx, this.llmFactory.getProvider(), modelConfig);
    }

    // Structured plan extraction via Instructor.js (main process)
    const result = await this.ipc.structuredPlan({
      provider: this.aiConfig.provider(),
      apiKey: ctx.state.apiKey!,
      systemPrompt: PLANNER_SYSTEM_PROMPT,
      userMessage: ctx.state.userMessage!,
      model: modelConfig.plannerModel,
      temperature: modelConfig.plannerTemperature,
      maxTokens: modelConfig.plannerMaxTokens,
    });

    if (!result.ok || !result.plan) {
      return Stage.terminate({
        success: false,
        error: result.error ?? 'Failed to extract structured plan from AI response',
        privacyReport: ctx.state.privacyReport,
      });
    }

    // The plan is already Zod-validated by Instructor in the main process.
    // Cast to our renderer-side AIPlan type.
    const raw = result.plan as Record<string, unknown>;
    const rawSteps = Array.isArray(raw['steps']) ? raw['steps'] as AIPlanStep[] : [];

    const steps = rawSteps.filter((s) => {
      if (s.stepType === 'code') return true;
      const opId = (s as AIDialogPlanStep).operationId;
      return isValidOperationId(opId);
    }) as AIPlanStep[];

    const clarifications = Array.isArray(raw['clarifications'])
      ? raw['clarifications'] as ClarificationItem[]
      : [];
    const hasClarifications = clarifications.length > 0;
    const allowEmptySteps = ctx.state.category === 'education_question';
    const canBeEmpty = allowEmptySteps || (steps.length === 0 && hasClarifications);

    if (!canBeEmpty && steps.length === 0) {
      return Stage.terminate({
        success: false,
        error: rawSteps.length > 0
          ? "This request couldn't be matched to a specific analysis. Try rephrasing as a request to perform an analysis."
          : 'Invalid response: missing plan steps',
        privacyReport: ctx.state.privacyReport,
      });
    }

    ctx.state.parsedPlan = {
      goal: typeof raw['goal'] === 'string' ? raw['goal'] : ctx.inputs.userInput,
      assumptions: Array.isArray(raw['assumptions']) ? raw['assumptions'] as string[] : [],
      clarifications,
      overallConfidence: typeof raw['overallConfidence'] === 'number' ? raw['overallConfidence'] : 0.5,
      requiresConfirmation: !!raw['requiresConfirmation'],
      executionMode: 'component_codegen',
      modeReason:
        typeof raw['modeReason'] === 'string' && (raw['modeReason'] as string).trim()
          ? raw['modeReason'] as string
          : ctx.state.modeDecision!.reason,
      modeConfidence:
        typeof raw['modeConfidence'] === 'number' ? raw['modeConfidence'] : ctx.state.modeDecision!.confidence,
      steps: steps as AIDialogPlanStep[],
    };

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
      clarifications: [],
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
