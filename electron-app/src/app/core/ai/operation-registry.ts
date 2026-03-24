/**
 * Operation Registry
 *
 * Taxonomy-first registry describing what the user wants to achieve
 * (primary/derived statistical intent), independent of specific dialogs.
 */

import type { DialogPromptContract } from './dialog-catalog';
import { getDialogContractsForPrompt } from './dialog-catalog-aggregator';

export type PrimaryKind =
  | 'data-preparation'
  | 'descriptive'
  | 'inferential'
  | 'predictive'
  | 'domain-specific';

export type DerivedKind =
  | 'reshape'
  | 'transform'
  | 'quality'
  | 'distribution'
  | 'comparison'
  | 'association'
  | 'hypothesis-test'
  | 'regression'
  | 'climatic-summary'
  | 'climatic-threshold'
  | 'climatic-extremes';

export interface OperationDefinition {
  id: string;
  label: string;
  primaryKind: PrimaryKind;
  derivedKind: DerivedKind;
  description: string;
  mappedDialogs: string[];
}

const LEGACY_OPERATION_REGISTRY: OperationDefinition[] = [
  {
    id: 'data.filter',
    label: 'Filter rows',
    primaryKind: 'data-preparation',
    derivedKind: 'transform',
    description: 'Subset rows by one or more conditions.',
    mappedDialogs: ['filter'],
  },
  {
    id: 'data.sort',
    label: 'Sort rows',
    primaryKind: 'data-preparation',
    derivedKind: 'transform',
    description: 'Order rows by one or more columns.',
    mappedDialogs: ['sort'],
  },
  {
    id: 'data.rename',
    label: 'Rename columns',
    primaryKind: 'data-preparation',
    derivedKind: 'transform',
    description: 'Rename one or more columns.',
    mappedDialogs: ['rename'],
  },
  {
    id: 'data.calculate',
    label: 'Calculate derived column',
    primaryKind: 'data-preparation',
    derivedKind: 'quality',
    description: 'Create a calculated column using a formula or column arithmetic.',
    mappedDialogs: ['calculate'],
  },
  {
    id: 'data.recode',
    label: 'Recode column values',
    primaryKind: 'data-preparation',
    derivedKind: 'transform',
    description: 'Map existing values in a column to new values.',
    mappedDialogs: ['recode'],
  },
  {
    id: 'data.reshape',
    label: 'Reshape or merge data',
    primaryKind: 'data-preparation',
    derivedKind: 'reshape',
    description: 'Combine tables or convert between wide and long data layouts.',
    mappedDialogs: ['merge', 'stack', 'unstack'],
  },
  {
    id: 'describe.distribution.numeric',
    label: 'Numeric distribution',
    primaryKind: 'descriptive',
    derivedKind: 'distribution',
    description: 'Visualize distribution of numeric variables.',
    mappedDialogs: ['boxplot'],
  },
  {
    id: 'describe.comparison.numeric_by_group',
    label: 'Compare numeric by group',
    primaryKind: 'descriptive',
    derivedKind: 'comparison',
    description: 'Compare numeric variable across groups.',
    mappedDialogs: ['boxplot', 'summary'],
  },
  {
    id: 'describe.association.numeric_numeric',
    label: 'Numeric association',
    primaryKind: 'descriptive',
    derivedKind: 'association',
    description: 'Explore relationship between two numeric variables.',
    mappedDialogs: ['scatter', 'correlation'],
  },
  {
    id: 'describe.association.numeric_series',
    label: 'Numeric trend or distribution by group',
    primaryKind: 'descriptive',
    derivedKind: 'association',
    description: 'Visualize numeric values across categories or index progression.',
    mappedDialogs: ['line-plot', 'dot-plot'],
  },
  {
    id: 'inferential.t_test',
    label: 't-test',
    primaryKind: 'inferential',
    derivedKind: 'hypothesis-test',
    description: 'One-sample, two-sample, or paired t-test.',
    mappedDialogs: ['t-test'],
  },
  {
    id: 'predictive.linear_regression',
    label: 'Linear regression',
    primaryKind: 'predictive',
    derivedKind: 'regression',
    description: 'Linear model with one or more predictors.',
    mappedDialogs: ['regression'],
  },
  {
    id: 'climatic.summary',
    label: 'Climatic summary',
    primaryKind: 'domain-specific',
    derivedKind: 'climatic-summary',
    description: 'Aggregate climatic element by period.',
    mappedDialogs: ['climatic-summary', 'seasonal-summary', 'annual-rainfall'],
  },
  {
    id: 'climatic.extremes',
    label: 'Climatic extremes',
    primaryKind: 'domain-specific',
    derivedKind: 'climatic-extremes',
    description: 'Maximum/minimum climatic values by period.',
    mappedDialogs: ['extremes'],
  },
  {
    id: 'climatic.threshold_days',
    label: 'Climatic threshold day count',
    primaryKind: 'domain-specific',
    derivedKind: 'climatic-threshold',
    description: 'Count days matching threshold criteria.',
    mappedDialogs: ['day-count', 'spell-lengths'],
  },
];

function applyCatalogOperationMappings(
  catalog: DialogPromptContract[],
  legacy: OperationDefinition[]
): OperationDefinition[] {
  const byId = new Map(
    legacy.map((op) => [op.id, { ...op, mappedDialogs: [...op.mappedDialogs] }])
  );
  for (const entry of catalog) {
    for (const operationId of entry.operations) {
      const op = byId.get(operationId);
      if (!op) continue;
      if (!op.mappedDialogs.includes(entry.dialogId)) {
        op.mappedDialogs.push(entry.dialogId);
      }
    }
  }
  return [...byId.values()].map((op) => ({
    ...op,
    mappedDialogs: [...new Set(op.mappedDialogs)],
  }));
}

export const OPERATION_REGISTRY: OperationDefinition[] =
  applyCatalogOperationMappings(
    getDialogContractsForPrompt(),
    LEGACY_OPERATION_REGISTRY
  );

