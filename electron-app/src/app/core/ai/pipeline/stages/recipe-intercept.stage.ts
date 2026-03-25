import { Injectable, inject } from '@angular/core';
import type { PipelineStage, StageResult } from '../stage';
import { Stage } from '../stage';
import type { PipelineContext } from '../context';
import { RecipeRegistry } from '../../recipes/recipe-registry';

@Injectable({ providedIn: 'root' })
export class RecipeInterceptStage implements PipelineStage {
  readonly id = 'recipe-intercept';
  readonly errorPolicy = 'silent' as const;

  private readonly recipes = inject(RecipeRegistry);

  async execute(ctx: PipelineContext): Promise<StageResult> {
    if (ctx.state.modeDecision?.mode !== 'component_codegen') {
      return Stage.continue();
    }

    const recipePlan = this.recipes.tryBuild(ctx.inputs.userInput, ctx.inputs.dataContext);
    if (recipePlan) {
      return Stage.terminate({
        success: true,
        plan: recipePlan,
        privacyReport: ctx.state.privacyReport,
      });
    }

    return Stage.continue();
  }
}
