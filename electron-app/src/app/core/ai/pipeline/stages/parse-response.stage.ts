import { Injectable } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { extractJson } from '../../shared/json-extractor';
import { isValidOperationId } from '../../shared/operation-validator';
import type { AIPlan, AIDialogPlanStep, AIPlanStep } from '../../types/ai-plan.types';

@Injectable({ providedIn: 'root' })
export class ParseResponseStage implements PipelineStage {
  readonly id = 'parse-response';
  readonly errorPolicy = 'fatal' as const;

  async execute(ctx: PipelineContext): Promise<boolean> {
    const content = ctx.llmResponse!;
    const allowEmptySteps = ctx.category === 'education_question';

    try {
      const jsonContent = extractJson(content);
      const parsed = JSON.parse(jsonContent) as Partial<AIPlan>;
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

      if (!parsed || (!canBeEmpty && steps.length === 0)) {
        ctx.earlyResult = {
          success: false,
          error: 'Invalid response: missing plan steps',
          rawResponse: content,
          privacyReport: ctx.privacyReport,
        };
        return false;
      }

      if (rawSteps.length > 0 && steps.length === 0 && !canBeEmpty) {
        ctx.earlyResult = {
          success: false,
          error:
            "This request couldn't be matched to a specific analysis. For conceptual questions (e.g. 'What does a t-test tell us?') try asking to run a t-test on your data from the menu, or rephrase as a request to perform an analysis.",
          rawResponse: content,
          privacyReport: ctx.privacyReport,
        };
        return false;
      }

      ctx.parsedPlan = {
        goal: parsed.goal ?? ctx.rawUserInput,
        assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
        clarificationQuestions: Array.isArray(parsed.clarificationQuestions) ? parsed.clarificationQuestions : [],
        overallConfidence: typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0.5,
        requiresConfirmation: !!parsed.requiresConfirmation,
        executionMode: 'component_codegen',
        modeReason:
          typeof parsed.modeReason === 'string' && parsed.modeReason.trim()
            ? parsed.modeReason
            : ctx.modeDecision!.reason,
        modeConfidence:
          typeof parsed.modeConfidence === 'number' ? parsed.modeConfidence : ctx.modeDecision!.confidence,
        steps: steps as AIDialogPlanStep[],
      };

      return true;
    } catch (err) {
      ctx.earlyResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        rawResponse: content,
        privacyReport: ctx.privacyReport,
      };
      return false;
    }
  }
}
