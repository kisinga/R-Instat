import { Injectable, inject } from '@angular/core';
import type { PipelineStage, PipelineContext } from '../pipeline-stage';
import { PromptCategorizerService } from '../../prompt-categorizer.service';
import { CurrentDialogueRegistryService } from '../../current-dialogue-registry.service';
import type { PromptCategory } from '../../pipeline-types';
import type { DisambiguationSuggestion } from '../../types/ai-result.types';

const DISAMBIGUATION_SUGGESTION_TEXTS: Record<Exclude<PromptCategory, 'unclear'>, string> = {
  open_dialog:
    'I want to open a dialog (e.g. create a plot, run a test, filter or transform data).',
  refine_current_dialog: 'I want to change or extend the current dialog.',
  run_code: 'I want to run or write R code / a script.',
  education_question: 'I have a question about statistics or how something works.',
  data_quality_recipe: 'I want a data quality or missing-data workflow.',
};

function buildDisambiguationSuggestions(hasCurrentDialog: boolean): DisambiguationSuggestion[] {
  const suggestions: DisambiguationSuggestion[] = [];
  suggestions.push({
    text: DISAMBIGUATION_SUGGESTION_TEXTS.open_dialog,
    category: 'open_dialog',
  });
  if (hasCurrentDialog) {
    suggestions.push({
      text: DISAMBIGUATION_SUGGESTION_TEXTS.refine_current_dialog,
      category: 'refine_current_dialog',
    });
  }
  suggestions.push(
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.run_code, category: 'run_code' },
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.education_question, category: 'education_question' },
    { text: DISAMBIGUATION_SUGGESTION_TEXTS.data_quality_recipe, category: 'data_quality_recipe' }
  );
  return suggestions;
}

@Injectable({ providedIn: 'root' })
export class CategorizeStage implements PipelineStage {
  readonly id = 'categorize';
  readonly errorPolicy = 'fatal' as const;

  private readonly categorizer = inject(PromptCategorizerService);
  private readonly dialogRegistry = inject(CurrentDialogueRegistryService);

  async execute(ctx: PipelineContext): Promise<boolean> {
    const hasCurrent = this.dialogRegistry.hasCurrent();
    const { category, family } = await this.categorizer.categorize(
      ctx.aliasedInput!,
      hasCurrent
    );

    if (category === 'unclear') {
      ctx.earlyResult = {
        success: false,
        needsDisambiguation: true,
        disambiguationSuggestions: buildDisambiguationSuggestions(hasCurrent),
        privacyReport: ctx.privacyReport,
      };
      return false;
    }

    ctx.category = category;
    ctx.family = family;
    return true;
  }
}
