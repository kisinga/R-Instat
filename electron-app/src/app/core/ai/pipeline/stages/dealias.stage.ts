import { Injectable } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { deAliasPlan } from '../../pii-guard';

@Injectable({ providedIn: 'root' })
export class DealiasStage implements PipelineStage {
  readonly id = 'dealias';
  readonly errorPolicy = 'fatal' as const;

  async execute(ctx: PipelineContext): Promise<StageResult> {
    const normalizedPlan = deAliasPlan(ctx.state.parsedPlan!, ctx.state.aliasMaps!);

    // Guard: education questions should never have steps (strip hallucinated ones)
    if (ctx.state.category === 'education_question' && normalizedPlan.steps.length > 0) {
      normalizedPlan.steps = [];
    }

    ctx.state.finalPlan = normalizedPlan;
    return Stage.continue();
  }
}
