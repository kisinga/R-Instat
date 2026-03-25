import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { RecipeRegistry } from '../../recipes/recipe-registry';

@Injectable({ providedIn: 'root' })
export class RecipeInterceptStage implements PipelineStage {
  readonly id = 'recipe-intercept';
  readonly errorPolicy = 'silent' as const;

  private readonly recipes = inject(RecipeRegistry);

  async execute(ctx: PipelineContext): Promise<boolean> {
    if (ctx.modeDecision?.mode !== 'component_codegen') {
      return true;
    }

    const recipePlan = this.recipes.tryBuild(ctx.rawUserInput, ctx.rawDataContext);
    if (recipePlan) {
      ctx.earlyResult = {
        success: true,
        plan: recipePlan,
        privacyReport: ctx.privacyReport,
      };
      return false;
    }

    return true;
  }
}
