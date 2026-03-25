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

/**
 * Build the operation registry from catalog contracts as primary source.
 * Legacy entries provide metadata (label, kind, description) for known operations.
 * New operations from the catalog that aren't in the legacy list are auto-discovered
 * with inferred metadata from the dialog's family.
 */
function buildRegistryFromCatalog(
  catalog: DialogPromptContract[],
  legacy: OperationDefinition[]
): OperationDefinition[] {
  const legacyById = new Map(legacy.map((op) => [op.id, op]));
  const resultById = new Map<string, OperationDefinition>();

  // Seed from legacy (preserves metadata for known operations)
  for (const op of legacy) {
    resultById.set(op.id, { ...op, mappedDialogs: [...op.mappedDialogs] });
  }

  // Merge catalog: add dialog mappings + discover new operations
  for (const entry of catalog) {
    for (const operationId of entry.operations) {
      const existing = resultById.get(operationId);
      if (existing) {
        // Known operation - add dialog if not already mapped
        if (!existing.mappedDialogs.includes(entry.dialogId)) {
          existing.mappedDialogs.push(entry.dialogId);
        }
      } else {
        // New operation from catalog - infer metadata from dialog family
        resultById.set(operationId, {
          id: operationId,
          label: operationId.replace(/\./g, ' ').replace(/_/g, ' '),
          primaryKind: inferPrimaryKind(entry.family),
          derivedKind: inferDerivedKind(operationId),
          description: `${entry.description} (auto-discovered from ${entry.dialogId})`,
          mappedDialogs: [entry.dialogId],
        });
      }
    }
  }

  return [...resultById.values()].map((op) => ({
    ...op,
    mappedDialogs: [...new Set(op.mappedDialogs)],
  }));
}

function inferPrimaryKind(family: string): PrimaryKind {
  switch (family) {
    case 'plotting': return 'descriptive';
    case 'data-preparation': return 'data-preparation';
    case 'inferential': return 'inferential';
    case 'predictive': return 'predictive';
    case 'climatic': return 'domain-specific';
    default: return 'descriptive';
  }
}

function inferDerivedKind(operationId: string): DerivedKind {
  if (operationId.includes('reshape') || operationId.includes('merge')) return 'reshape';
  if (operationId.includes('transform') || operationId.includes('filter') || operationId.includes('sort')) return 'transform';
  if (operationId.includes('quality') || operationId.includes('missing')) return 'quality';
  if (operationId.includes('distribution')) return 'distribution';
  if (operationId.includes('comparison')) return 'comparison';
  if (operationId.includes('association')) return 'association';
  if (operationId.includes('hypothesis') || operationId.includes('test')) return 'hypothesis-test';
  if (operationId.includes('regression')) return 'regression';
  if (operationId.includes('climatic') && operationId.includes('summary')) return 'climatic-summary';
  if (operationId.includes('climatic') && operationId.includes('threshold')) return 'climatic-threshold';
  if (operationId.includes('climatic') && operationId.includes('extreme')) return 'climatic-extremes';
  return 'transform';
}

export const OPERATION_REGISTRY: OperationDefinition[] =
  buildRegistryFromCatalog(
    getDialogContractsForPrompt(),
    LEGACY_OPERATION_REGISTRY
  );

