import { Injectable } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { deAliasPlan } from '../../pii-guard';

@Injectable({ providedIn: 'root' })
export class DealiasStage implements PipelineStage {
  readonly id = 'dealias';
  readonly errorPolicy = 'fatal' as const;

  async execute(ctx: PipelineContext): Promise<boolean> {
    const normalizedPlan = deAliasPlan(ctx.parsedPlan!, ctx.aliasMaps!);

    // Guard: education questions should never have steps (strip hallucinated ones)
    if (ctx.category === 'education_question' && normalizedPlan.steps.length > 0) {
      normalizedPlan.steps = [];
    }

    ctx.finalPlan = normalizedPlan;
    return true;
  }
}
