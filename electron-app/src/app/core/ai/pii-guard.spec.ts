import type { AIPlan } from './types/ai-plan.types';
import type { DataContext } from './types/data-context.types';
import {
  aliasDataContext,
  applyAliasesToInput,
  deAliasPlan,
  redactUserInput,
} from './pii-guard';

describe('pii guard', () => {
  const context: DataContext = {
    dataframes: ['customers'],
    activeDataframe: 'customers',
    columnsByDataframe: {
      customers: [
        { name: 'email', type: 'character' },
        { name: 'age', type: 'numeric' },
      ],
    },
  };

  it('redacts common PII patterns from user input', () => {
    const result = redactUserInput('Contact me at jane@example.com or 555-222-3333');
    expect(result.value).toContain('[REDACTED_EMAIL]');
    expect(result.value).toContain('[REDACTED_PHONE]');
    expect(result.patterns).toContain('email');
    expect(result.patterns).toContain('phone');
  });

  it('aliases dataframe and column identifiers in prompt input', () => {
    const { maps } = aliasDataContext(context);
    const aliased = applyAliasesToInput('Use customers and email', maps);
    expect(aliased).toContain('df_1');
    expect(aliased).toContain('df_1_col_1');
    expect(aliased).not.toContain('customers');
    expect(aliased).not.toContain('email');
  });

  it('de-aliases AI plan state back to real identifiers', () => {
    const { maps } = aliasDataContext(context);
    const aliasedPlan: AIPlan = {
      goal: 'test',
      assumptions: [],
      clarifications: [],
      overallConfidence: 0.8,
      requiresConfirmation: false,
      executionMode: 'component_codegen',
      modeReason: 'test',
      modeConfidence: 0.8,
      steps: [
        {
          stepId: 's1',
          operationId: 'data.filter',
          dialogId: 'filter',
          state: {
            dataframe: 'df_1',
            conditions: [{ column: 'df_1_col_1', operator: 'is.na', value: '' }],
          },
          inferredFields: [],
          confidence: 0.8,
        },
      ],
    };

    const restored = deAliasPlan(aliasedPlan, maps);
    const state = restored.steps[0].state as Record<string, unknown>;
    expect(state['dataframe']).toBe('customers');
    const conditions = state['conditions'] as Array<Record<string, unknown>>;
    expect(conditions[0]['column']).toBe('email');
  });
});
