import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { ResponseParser } from '../response-parser';
import { isValidOperationId } from '../../shared/operation-validator';
import type { AIPlan, AIDialogPlanStep, AIPlanStep } from '../../types/ai-plan.types';

@Injectable({ providedIn: 'root' })
export class ParseResponseStage implements PipelineStage {
  readonly id = 'parse-response';
  readonly errorPolicy = 'fatal' as const;

  private readonly responseParser = inject(ResponseParser);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const content = ctx.state.llmResponse!;
    const allowEmptySteps = ctx.state.category === 'education_question';

    const parsed = this.responseParser.extractEnvelope<Partial<AIPlan>>(
      content,
      'plan',
      (body) => (typeof body === 'object' && body !== null ? body as Partial<AIPlan> : null)
    );
    if (!parsed) {
      console.warn('[ParseResponse] Failed to parse plan envelope from AI response:', content);
      return Stage.terminate({
        success: false,
        error: 'Invalid response: could not parse JSON from AI response',
        rawResponse: content,
        privacyReport: ctx.state.privacyReport,
      });
    }

    const rawSteps = Array.isArray(parsed.steps) ? parsed.steps : [];

    const steps = rawSteps.filter((s) => {
      if (s.stepType === 'code') return true;
      const opId = (s as AIDialogPlanStep).operationId;
      return isValidOperationId(opId);
    }) as AIPlanStep[];

    const hasClarifications =
      Array.isArray(parsed.clarificationQuestions) && parsed.clarificationQuestions.length > 0;
    const canBeEmpty =
      allowEmptySteps || (steps.length === 0 && hasClarifications);

    if (!canBeEmpty && steps.length === 0) {
      return Stage.terminate({
        success: false,
        error: rawSteps.length > 0
          ? "This request couldn't be matched to a specific analysis. For conceptual questions (e.g. 'What does a t-test tell us?') try asking to run a t-test on your data from the menu, or rephrase as a request to perform an analysis."
          : 'Invalid response: missing plan steps',
        rawResponse: content,
        privacyReport: ctx.state.privacyReport,
      });
    }

    ctx.state.parsedPlan = {
      goal: parsed.goal ?? ctx.inputs.userInput,
      assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
      clarificationQuestions: Array.isArray(parsed.clarificationQuestions) ? parsed.clarificationQuestions : [],
      overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0.5,
      requiresConfirmation: !!parsed.requiresConfirmation,
      executionMode: 'component_codegen',
      modeReason:
        typeof parsed.modeReason === 'string' && parsed.modeReason.trim()
          ? parsed.modeReason
          : ctx.state.modeDecision!.reason,
      modeConfidence:
        typeof parsed.modeConfidence === 'number' ? parsed.modeConfidence : ctx.state.modeDecision!.confidence,
      steps: steps as AIDialogPlanStep[],
    };

    return Stage.continue();
  }
}
