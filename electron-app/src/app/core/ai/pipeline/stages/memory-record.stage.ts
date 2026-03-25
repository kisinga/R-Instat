import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import type { AIDialogPlanStep } from '../../types/ai-plan.types';
import { VectorMemoryService } from '../../../vector/vector-memory.service';

@Injectable({ providedIn: 'root' })
export class MemoryRecordStage implements PipelineStage {
  readonly id = 'memory-record';
  readonly errorPolicy = 'warn' as const;

  private readonly vectorMemory = inject(VectorMemoryService, { optional: true });

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const plan = ctx.state.finalPlan;
    if (!this.vectorMemory || !plan?.steps?.length) {
      return Stage.continue();
    }

    // Only record for component_codegen mode (not direct_r or structured_codegen)
    if (ctx.state.modeDecision?.mode !== 'component_codegen') {
      return Stage.continue();
    }

    const firstStep = plan.steps[0];
    if (firstStep.stepType === 'code') {
      return Stage.continue();
    }

    const dialogStep = firstStep as AIDialogPlanStep;

    try {
      await this.vectorMemory.recordInteraction(
        ctx.inputs.userInput,
        dialogStep.dialogId,
        dialogStep.operationId,
        (dialogStep.state ?? {}) as Record<string, unknown>,
        true,
        ctx.state.modeDecision?.mode,
        dialogStep.confidence
      );
    } catch (err) {
      ctx.diagnostics.debugLog.push(`[memory-record] Failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }

    return Stage.continue();
  }
}
