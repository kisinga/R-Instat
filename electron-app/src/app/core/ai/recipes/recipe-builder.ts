import type { AIPlan } from '../types/ai-plan.types';
import type { DataContext } from '../types/data-context.types';

export interface RecipeBuilder {
  readonly id: string;
  /** Return null if this recipe does not match the user input. */
  tryBuild(userInput: string, dataContext: DataContext): AIPlan | null;
}
