import { Injectable } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import type { AICodePlanStep, AIDialogPlanStep } from '../../types/ai-plan.types';
import { compileStepByDialogId } from '../../step-to-r';

@Injectable({ providedIn: 'root' })
export class PostGuardsStage implements PipelineStage {
  readonly id = 'post-guards';
  readonly errorPolicy = 'warn' as const;

  async execute(ctx: PipelineContext): Promise<StageResult> {
    if (ctx.state.modeDecision!.mode !== 'structured_codegen') {
      return Stage.continue();
    }

    const dialogPlan = ctx.state.finalPlan!;
    const steps: AICodePlanStep[] = [];

    for (const step of dialogPlan.steps) {
      if (step.stepType === 'code') continue;

      const dialogStep = step as AIDialogPlanStep;
      const script = compileStepByDialogId(dialogStep.dialogId, dialogStep.state ?? {});
      if (!script) continue;

      steps.push({
        stepType: 'code',
        stepId: `${step.stepId}-code`,
        dependsOnStepId: step.dependsOnStepId ? `${step.dependsOnStepId}-code` : undefined,
        executionMode: 'structured_codegen',
        script,
        expectedOutputs: [`Result of ${dialogStep.dialogId}`],
        safetyFlags: ['template_compiled'],
        operationId: dialogStep.operationId,
        dialogId: dialogStep.dialogId,
        state: dialogStep.state,
        inferredFields: step.inferredFields,
        confidence: Math.max(0.55, step.confidence - 0.05),
        rationale: step.rationale,
      });
    }

    if (steps.length === 0) {
      ctx.state.finalPlan = {
        ...dialogPlan,
        executionMode: 'component_codegen',
        modeReason: 'Structured templates unavailable for generated steps; fallback to component mode.',
        modeConfidence: 0.6,
      };
      ctx.diagnostics.warnings.push('Structured codegen fallback to component mode — no templates matched');
    } else {
      ctx.state.finalPlan = {
        ...dialogPlan,
        executionMode: 'structured_codegen',
        modeReason: ctx.state.modeDecision!.reason,
        modeConfidence: ctx.state.modeDecision!.confidence,
        steps,
      };
    }

    return Stage.continue();
  }
}
