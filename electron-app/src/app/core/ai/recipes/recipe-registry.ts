import { Injectable } from '@angular/core';
import type { RecipeBuilder } from './recipe-builder';
import type { AIPlan } from '../types/ai-plan.types';
import type { DataContext } from '../types/data-context.types';
import { DataQualityRecipeBuilder } from './data-quality-recipe';

@Injectable({ providedIn: 'root' })
export class RecipeRegistry {
  private readonly builders: RecipeBuilder[] = [
    new DataQualityRecipeBuilder(),
  ];

  /** Try each registered recipe builder; return first match or null. */
  tryBuild(userInput: string, dataContext: DataContext): AIPlan | null {
    for (const builder of this.builders) {
      const plan = builder.tryBuild(userInput, dataContext);
      if (plan) return plan;
    }
    return null;
  }
}
