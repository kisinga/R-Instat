import type { DialogSchema } from './dialog-schema.registry';
import type { OperationDefinition } from './operation-registry';
import type { DialogContractV2, DialogPromptContractV2 } from './dialog-contract-v2';

const p = (
  name: string,
  kind: DialogSchema['params'][number]['kind'],
  opts: Omit<DialogSchema['params'][number], 'name' | 'kind'> = {}
): DialogSchema['params'][number] => ({ name, kind, ...opts });

/**
 * Pilot V2 contracts for plotting family.
 * Additional dialogs will be moved here in rollout waves.
 */
const CONTRACTS_V2: DialogContractV2[] = [
  {
    dialogId: 'bar-chart',
    componentType: 'BarChartDialogComponent',
    family: 'plotting',
    description: 'Bar chart for categorical counts or numeric values by category.',
    operations: ['describe.distribution.numeric', 'describe.comparison.numeric_by_group'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('chartType', 'enum', { required: true, enumValues: ['frequency', 'value'] }),
      p('xVariable', 'column', { required: true, columnType: 'factor' }),
      p('yVariable', 'column', { required: true, columnType: 'numeric', when: { param: 'chartType', equals: 'value' } }),
      p('fillVariable', 'column', { columnType: 'factor' }),
      p('position', 'enum', { enumValues: ['stack', 'dodge', 'fill'] }),
      p('horizontal', 'boolean'),
      p('title', 'string'),
      p('outputName', 'string'),
    ],
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
    description: 'Histogram of numeric variable.',
    operations: ['describe.distribution.numeric'],
    params: [
      p('dataframe', 'dataframe', { required: true }),
      p('variable', 'column', { required: true, columnType: 'numeric' }),
      p('bins', 'number', { min: 5, max: 100 }),
      p('fillColor', 'string'),
      p('facetBy', 'column', { columnType: 'factor' }),
      p('title', 'string'),
      p('outputName', 'string'),
    ],
    retrievalHints: {
      keywords: ['histogram', 'distribution', 'numeric', 'bins', 'frequency'],
    },
    migration: {
      parityStatus: 'complete',
    },
  },
];

const CONTRACT_BY_ID = new Map<string, DialogContractV2>(CONTRACTS_V2.map((x) => [x.dialogId, x]));

export class DialogContractV2Registry {
  static list(): DialogContractV2[] {
    return CONTRACTS_V2;
  }

  static get(dialogId: string): DialogContractV2 | undefined {
    return CONTRACT_BY_ID.get(dialogId);
  }

  static getSchemas(): DialogSchema[] {
    return CONTRACTS_V2.map((contract) => ({
      dialogId: contract.dialogId,
      description: contract.description,
      operations: contract.operations,
      params: contract.params,
    }));
  }

  static applyOperationMappings(legacy: OperationDefinition[]): OperationDefinition[] {
    const byId = new Map(legacy.map((op) => [op.id, { ...op, mappedDialogs: [...op.mappedDialogs] }]));
    for (const contract of CONTRACTS_V2) {
      for (const operationId of contract.operations) {
        const op = byId.get(operationId);
        if (!op) {
          continue;
        }
        if (!op.mappedDialogs.includes(contract.dialogId)) {
          op.mappedDialogs.push(contract.dialogId);
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
    for (const contract of CONTRACTS_V2) {
      next[contract.dialogId] = contract.componentType;
    }
    return next;
  }

  static getPromptContracts(): DialogPromptContractV2[] {
    return CONTRACTS_V2.map((contract) => ({
      dialogId: contract.dialogId,
      componentType: contract.componentType,
      family: contract.family,
      description: contract.description,
      operations: contract.operations,
      params: contract.params,
      retrievalHints: contract.retrievalHints,
    }));
  }
}

