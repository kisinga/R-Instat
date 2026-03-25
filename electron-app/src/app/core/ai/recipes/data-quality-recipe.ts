import type { RecipeBuilder } from './recipe-builder';
import type { AIPlan, AIPlanStep } from '../types/ai-plan.types';
import type { DataContext } from '../types/data-context.types';
import { mapColumnType } from '../shared/column-type-mapper';

export class DataQualityRecipeBuilder implements RecipeBuilder {
  readonly id = 'data-quality';

  tryBuild(userInput: string, dataContext: DataContext): AIPlan | null {
    const text = userInput.toLowerCase();
    const qualityKeywords = ['gap', 'gaps', 'inconsisten', 'missing', 'completeness', 'quality', 'effectiveness'];
    const hasQualityIntent = qualityKeywords.some((k) => text.includes(k));
    if (!hasQualityIntent) {
      return null;
    }

    const dataframe = dataContext.activeDataframe ?? dataContext.dataframes[0];
    if (!dataframe) {
      return null;
    }

    const columns = dataContext.columnsByDataframe[dataframe] ?? [];
    const allColumnNames = columns.map((c) => c.name);
    if (allColumnNames.length === 0) {
      return null;
    }

    const groupColumn = this.findBestGroupColumn(userInput, columns);
    const missingFocusColumn =
      columns.find((c) => /(contract|value|amount|cost|price|score|quantity)/i.test(c.name))?.name
      ?? columns.find((c) => mapColumnType(c.type) === 'numeric')?.name
      ?? allColumnNames[0];

    const assumptions = [
      'Effectiveness is approximated by data quality (completeness and consistency signals).',
      'Missing entries are represented as NA/null values.',
      groupColumn
        ? `Grouping entity is "${groupColumn}" based on available columns.`
        : 'A user/group column is not explicit; workflow defaults to row-level quality scoring until clarified.',
    ];

    const clarificationQuestions = groupColumn
      ? []
      : [
          'Which column identifies the user/entity to score (for example user_id, owner, contributor, or w_name)?',
        ];

    const selectedColumns = allColumnNames.slice(0, 20);
    const steps: AIPlanStep[] = [
      {
        stepId: 'quality-summary',
        operationId: 'describe.comparison.numeric_by_group',
        dialogId: 'summary',
        state: {
          dataframe,
          selectedColumns,
          groupByColumn: groupColumn ?? '',
          summaryMode: 'default',
          omitMissing: true,
        },
        inferredFields: groupColumn ? [] : ['groupByColumn'],
        confidence: groupColumn ? 0.9 : 0.72,
        rationale: 'Start with grouped summary to inspect completeness and anomalies across fields.',
      },
      {
        stepId: 'missing-records',
        operationId: 'data.filter',
        dialogId: 'filter',
        dependsOnStepId: 'quality-summary',
        state: {
          dataframe,
          conditions: [{ column: missingFocusColumn, operator: 'is.na', value: '' }],
          combineLogic: '&',
        },
        inferredFields: ['conditions'],
        confidence: 0.86,
        rationale: 'Isolate records with missing values in a key field for focused review.',
      },
      {
        stepId: 'quality-score',
        operationId: 'data.calculate',
        dialogId: 'calculate',
        dependsOnStepId: 'missing-records',
        state: {
          dataframe,
          newColumnName: 'quality_score',
          calcType: 'formula',
          formula: 'rowSums(!is.na(across(everything()))) / ncol(cur_data())',
        },
        inferredFields: ['formula'],
        confidence: 0.84,
        rationale: 'Create a normalized row-level completeness score between 0 and 1.',
      },
      {
        stepId: 'rank-quality',
        operationId: 'data.sort',
        dialogId: 'sort',
        dependsOnStepId: 'quality-score',
        state: {
          dataframe,
          sortColumns: [{ column: 'quality_score', descending: true }],
        },
        inferredFields: [],
        confidence: 0.9,
        rationale: 'Rank rows/entities by quality score to identify strongest and weakest quality outcomes.',
      },
    ];

    return {
      goal: `Assess data quality${groupColumn ? ` by ${groupColumn}` : ''} and rank effectiveness using a completeness score`,
      assumptions,
      clarificationQuestions,
      overallConfidence: groupColumn ? 0.88 : 0.74,
      requiresConfirmation: clarificationQuestions.length > 0,
      executionMode: 'component_codegen',
      modeReason: 'Deterministic quality recipe matched request intent.',
      modeConfidence: 0.9,
      steps,
    };
  }

  private findBestGroupColumn(
    userInput: string,
    columns: Array<{ name: string; type: string }>
  ): string | null {
    const lower = userInput.toLowerCase();
    const normalizedColumns = columns.map((c) => ({ ...c, lowerName: c.name.toLowerCase() }));

    const exactMention = normalizedColumns.find((c) => lower.includes(c.lowerName));
    if (exactMention) {
      return exactMention.name;
    }

    const byMatch = lower.match(/\b(?:by|per|each)\s+([a-z0-9_]+)/i);
    if (byMatch?.[1]) {
      const token = byMatch[1].toLowerCase();
      const matched = normalizedColumns.find((c) => c.lowerName === token || c.lowerName.includes(token));
      if (matched) {
        return matched.name;
      }
    }

    const ranked = normalizedColumns
      .map((c) => {
        const typeScore = mapColumnType(c.type) === 'factor' ? 2 : 0;
        let nameScore = 0;
        if (/(user|username|user_id|owner|contributor|author|created_by|w_name|name|entity|group)/i.test(c.name)) {
          nameScore = 4;
        } else if (/(id|code)/i.test(c.name)) {
          nameScore = 2;
        }
        return { name: c.name, score: typeScore + nameScore };
      })
      .sort((a, b) => b.score - a.score);

    return ranked[0] && ranked[0].score > 0 ? ranked[0].name : null;
  }
}
