import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import type { AIDialogPlanStep } from '../../types/ai-plan.types';
import { VectorMemoryService } from '../../../vector/vector-memory.service';

@Injectable({ providedIn: 'root' })
export class MemoryRecordStage implements PipelineStage {
  readonly id = 'memory-record';
  readonly errorPolicy = 'warn' as const;

  private readonly vectorMemory = inject(VectorMemoryService, { optional: true });

  async execute(ctx: PipelineContext): Promise<boolean> {
    const plan = ctx.finalPlan;
    if (!this.vectorMemory || !plan?.steps?.length) {
      return true;
    }

    // Only record for structured codegen mode (not direct_r or education)
    if (ctx.modeDecision?.mode === 'structured_codegen') {
      return true;
    }

    const firstStep = plan.steps[0];
    if (firstStep.stepType === 'code') {
      return true;
    }

    const dialogStep = firstStep as AIDialogPlanStep;

    try {
      await this.vectorMemory.recordInteraction(
        ctx.rawUserInput,
        dialogStep.dialogId,
        dialogStep.operationId,
        (dialogStep.state ?? {}) as Record<string, unknown>,
        true,
        ctx.modeDecision?.mode,
        dialogStep.confidence
      );
    } catch (err) {
      ctx.debugLog.push(`[memory-record] Failed: ${err instanceof Error ? err.message : String(err)}`);
      // errorPolicy is 'warn' — pipeline orchestrator handles surfacing
      throw err;
    }

    return true;
  }
}
