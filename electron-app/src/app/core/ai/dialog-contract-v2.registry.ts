import { getSchema, type DialogSchema } from './dialog-schema.registry';
import type { OperationDefinition } from './operation-registry';
import type { DialogContractV2, DialogPromptContractV2 } from './dialog-contract-v2';

/**
 * V2 overlay: only metadata not already in the schema registry.
 * Params, description, operations come from getSchema(dialogId).
 */
export interface DialogContractV2Overlay {
  dialogId: string;
  componentType: string;
  family: DialogContractV2['family'];
  retrievalHints: { keywords: string[] };
  migration: { parityStatus: 'pilot' | 'in-progress' | 'complete'; parityArtifactPath?: string };
}

const OVERLAYS: DialogContractV2Overlay[] = [
  {
    dialogId: 'bar-chart',
    componentType: 'BarChartDialogComponent',
    family: 'plotting',
    retrievalHints: {
      keywords: ['bar', 'bars', 'count', 'category', 'frequency', 'group', 'comparison'],
    },
    migration: {
      parityStatus: 'complete',
      parityArtifactPath: 'src/app/core/ai/bar-chart-parity-contract.md',
    },
  },
  {
    dialogId: 'histogram',
    componentType: 'HistogramDialogComponent',
    family: 'plotting',
    retrievalHints: {
      keywords: ['histogram', 'distribution', 'numeric', 'bins', 'frequency'],
    },
    migration: { parityStatus: 'complete' },
  },
  {
    dialogId: 'filter',
    componentType: 'FilterDialogComponent',
    family: 'data-preparation',
    retrievalHints: {
      keywords: ['filter', 'subset', 'rows', 'condition', 'where', 'keep', 'exclude'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'sort',
    componentType: 'SortDialogComponent',
    family: 'data-preparation',
    retrievalHints: {
      keywords: ['sort', 'order', 'ascending', 'descending', 'order by'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'scatter',
    componentType: 'ScatterDialogComponent',
    family: 'plotting',
    retrievalHints: {
      keywords: ['scatter', 'scatter plot', 'x y', 'two numeric', 'relationship'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'boxplot',
    componentType: 'BoxplotDialogComponent',
    family: 'plotting',
    retrievalHints: {
      keywords: ['boxplot', 'box plot', 'distribution', 'quartile', 'outlier'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 't-test',
    componentType: 'TTestDialogComponent',
    family: 'inferential',
    retrievalHints: {
      keywords: ['t-test', 'ttest', 't test', 'one-sample', 'two-sample', 'paired', 'hypothesis'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'regression',
    componentType: 'RegressionDialogComponent',
    family: 'predictive',
    retrievalHints: {
      keywords: ['regression', 'linear model', 'predictor', 'lm', 'linear'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'correlation',
    componentType: 'CorrelationDialogComponent',
    family: 'inferential',
    retrievalHints: {
      keywords: ['correlation', 'correlate', 'pearson', 'spearman', 'association'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'calculate',
    componentType: 'CalculateDialogComponent',
    family: 'data-preparation',
    retrievalHints: {
      keywords: ['calculate', 'new column', 'derived', 'formula', 'computed'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'rename',
    componentType: 'RenameDialogComponent',
    family: 'data-preparation',
    retrievalHints: {
      keywords: ['rename', 'rename column', 'column name', 'relabel'],
    },
    migration: { parityStatus: 'pilot' },
  },
  {
    dialogId: 'recode',
    componentType: 'RecodeDialogComponent',
    family: 'data-preparation',
    retrievalHints: {
      keywords: ['recode', 'recode column', 'map', 'replace values', 'categorise'],
    },
    migration: { parityStatus: 'pilot' },
  },
];

const OVERLAY_BY_ID = new Map<string, DialogContractV2Overlay>(
  OVERLAYS.map((x) => [x.dialogId, x])
);

function mergeOverlayWithSchema(overlay: DialogContractV2Overlay): DialogContractV2 | null {
  const schema = getSchema(overlay.dialogId);
  if (!schema) return null;
  return {
    dialogId: overlay.dialogId,
    componentType: overlay.componentType,
    family: overlay.family,
    description: schema.description,
    operations: schema.operations,
    params: schema.params,
    retrievalHints: overlay.retrievalHints,
    migration: overlay.migration,
  };
}

export class DialogContractV2Registry {
  static list(): DialogContractV2[] {
    return OVERLAYS.map((o) => mergeOverlayWithSchema(o)).filter(
      (c): c is DialogContractV2 => c !== null
    );
  }

  static get(dialogId: string): DialogContractV2 | undefined {
    const overlay = OVERLAY_BY_ID.get(dialogId);
    return overlay ? mergeOverlayWithSchema(overlay) ?? undefined : undefined;
  }

  static getSchemas(): DialogSchema[] {
    return OVERLAYS.map((o) => getSchema(o.dialogId)).filter(
      (s): s is DialogSchema => s !== undefined
    );
  }

  static applyOperationMappings(legacy: OperationDefinition[]): OperationDefinition[] {
    const byId = new Map(legacy.map((op) => [op.id, { ...op, mappedDialogs: [...op.mappedDialogs] }]));
    for (const overlay of OVERLAYS) {
      const schema = getSchema(overlay.dialogId);
      if (!schema) continue;
      for (const operationId of schema.operations) {
        const op = byId.get(operationId);
        if (!op) continue;
        if (!op.mappedDialogs.includes(overlay.dialogId)) {
          op.mappedDialogs.push(overlay.dialogId);
        }
      }
    }
    return [...byId.values()].map((op) => ({
      ...op,
      mappedDialogs: [...new Set(op.mappedDialogs)],
    }));
  }

  static applyIdentityMappings(legacy: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
    const next: Record<string, string> = { ...legacy };
    for (const overlay of OVERLAYS) {
      next[overlay.dialogId] = overlay.componentType;
    }
    return next;
  }

  static getPromptContracts(): DialogPromptContractV2[] {
    return OVERLAYS.map((overlay) => {
      const schema = getSchema(overlay.dialogId);
      if (!schema) return null;
      return {
        dialogId: overlay.dialogId,
        componentType: overlay.componentType,
        family: overlay.family,
        description: schema.description,
        operations: schema.operations,
        params: schema.params,
        retrievalHints: overlay.retrievalHints,
      };
    }).filter((c): c is DialogPromptContractV2 => c !== null);
  }
}
