import '../../features/dialogs/dialog-host.component';
import { OPERATION_REGISTRY } from './operation-registry';
import {
  getComponentType,
  getDialogContract,
  listDialogIds,
} from './dialog-identity.registry';
import { getDialogContractsForPrompt } from './dialog-catalog-aggregator';
import { buildParityConsistencyReport } from './dialog-parity-check';
import { getMetadataStateDiagnostics } from './dialog-metadata-contract';
import { IntentResolverService } from '../services/intent-resolver.service';
import type { AICallResult } from './types/ai-result.types';
import type { DataContext } from './types/data-context.types';
import { MergeDialogComponent } from '../../features/dialogs/merge/merge-dialog.component';
import { StackDialogComponent } from '../../features/dialogs/stack/stack-dialog.component';
import { UnstackDialogComponent } from '../../features/dialogs/unstack/unstack-dialog.component';
import { LinePlotDialogComponent } from '../../features/dialogs/line-plot/line-plot-dialog.component';
import { DotPlotDialogComponent } from '../../features/dialogs/dot-plot/dot-plot-dialog.component';
import { BarChartDialogComponent } from '../../features/dialogs/bar-chart/bar-chart-dialog.component';

describe('dialog contract composition', () => {
  it('keeps schema, operation mappings, and host dialogs consistent', () => {
    const report = buildParityConsistencyReport();
    expect(report.ok).toBeTrue();
    expect(report.hostWithoutSchema).toEqual([]);
    expect(report.schemaWithoutHost).toEqual([]);
    expect(report.operationWithoutSchema).toEqual([]);
    expect(report.operationWithoutHost).toEqual([]);
    expect(report.schemaWithoutOperation).toEqual([]);
    expect(report.catalogWithoutSchema).toEqual([]);
    expect(report.catalogWithoutOperation).toEqual([]);
    expect(report.catalogWithoutHost).toEqual([]);
    expect(report.parityEvidenceMissingForCatalog).toEqual([]);
  });

  it('resolves component types for all catalog dialogs', () => {
    const catalog = getDialogContractsForPrompt();
    for (const entry of catalog) {
      expect(getComponentType(entry.dialogId)).withContext(entry.dialogId).toBeDefined();
      expect(getDialogContract(entry.dialogId)?.schema).withContext(entry.dialogId).toBeDefined();
    }
  });

  it('resolves component types for all operation-mapped dialogs', () => {
    const mappedDialogs = new Set(OPERATION_REGISTRY.flatMap((op) => op.mappedDialogs));
    for (const dialogId of mappedDialogs) {
      expect(getComponentType(dialogId)).withContext(dialogId).toBeDefined();
    }
  });

  it('ensures all operation-mapped dialogs have catalog entries', () => {
    const mappedDialogs = new Set(OPERATION_REGISTRY.flatMap((op) => op.mappedDialogs));
    const catalogDialogIds = new Set(getDialogContractsForPrompt().map((c) => c.dialogId));
    for (const dialogId of mappedDialogs) {
      expect(catalogDialogIds.has(dialogId)).withContext(dialogId).toBeTrue();
    }
  });

  it('builds prompt contracts including component type and params', () => {
    const contracts = getDialogContractsForPrompt();
    expect(contracts.length).toBeGreaterThan(0);
    expect(contracts.every((entry) => !!entry.componentType)).toBeTrue();
    expect(contracts.every((entry) => Array.isArray(entry.params))).toBeTrue();
  });

  it('publishes plotting pilot via catalog from dialogs', () => {
    const promptContracts = getDialogContractsForPrompt();
    expect(promptContracts.map((x) => x.dialogId)).toContain('bar-chart');
    expect(promptContracts.map((x) => x.dialogId)).toContain('histogram');

    const barChart = promptContracts.find((x) => x.dialogId === 'bar-chart');
    const histogram = promptContracts.find((x) => x.dialogId === 'histogram');
    expect(barChart?.componentType).toBe('BarChartDialogComponent');
    expect(histogram?.componentType).toBe('HistogramDialogComponent');
  });

  it('lists only analytical host dialogs when requested', () => {
    const ids = listDialogIds({ includeNonAnalytical: false });
    expect(ids).toContain('summary');
    expect(ids).not.toContain('import');
    expect(ids).not.toContain('ai-assist');
  });
});

describe('dialog identity contract', () => {
  it('uses explicit static dialogId on migrated analytical dialogs', () => {
    expect(MergeDialogComponent.dialogId).toBe('merge');
    expect(StackDialogComponent.dialogId).toBe('stack');
    expect(UnstackDialogComponent.dialogId).toBe('unstack');
    expect(LinePlotDialogComponent.dialogId).toBe('line-plot');
    expect(DotPlotDialogComponent.dialogId).toBe('dot-plot');
    expect(BarChartDialogComponent.dialogId).toBe('bar-chart');
  });
});

describe('metadata diagnostics', () => {
  it('flags unknown and unregistered keys for restore observability', () => {
    const diagnostics = getMetadataStateDiagnostics(
      'bar-chart',
      {
        dataframe: 'df1',
        xVariable: 'species',
        fillVariable: 'group',
        badField: 'should-warn',
      },
      ['xVariable']
    );

    expect(diagnostics.unknownKeys).toEqual(['badField']);
    expect(diagnostics.unregisteredKeys).toEqual(['fillVariable']);
  });
});

describe('intent resolver integration', () => {
  it('builds dialog metadata with component type from shared registry', () => {
    const resolver = new IntentResolverService();
    const dataContext: DataContext = {
      dataframes: ['df1'],
      activeDataframe: 'df1',
      columnsByDataframe: {
        df1: [
          { name: 'height', type: 'numeric' },
          { name: 'species', type: 'factor' },
        ],
      },
    };

    const aiResult: AICallResult = {
      success: true,
      plan: {
        goal: 'Plot a histogram',
        assumptions: [],
        clarificationQuestions: [],
        overallConfidence: 0.9,
        requiresConfirmation: false,
        executionMode: 'component_codegen',
        modeReason: 'dialog available',
        modeConfidence: 0.9,
        steps: [
          {
            stepId: 's1',
            stepType: 'dialog',
            operationId: 'describe.distribution.numeric',
            dialogId: 'histogram',
            dependsOnStepId: undefined,
            state: {
              dataframe: 'df1',
              variable: 'height',
            },
            inferredFields: ['variable'],
            confidence: 0.9,
            rationale: 'Histogram best matches request',
          },
        ],
      },
    };

    const resolved = resolver.resolve(aiResult, dataContext);
    expect(resolved.ok).toBeTrue();
    expect(resolved.plan?.steps[0].metadata?.componentType).toBe('HistogramDialogComponent');
  });

  it('normalizes bar-chart to value mode when yVariable is provided', () => {
    const resolver = new IntentResolverService();
    const dataContext: DataContext = {
      dataframes: ['df1'],
      activeDataframe: 'df1',
      columnsByDataframe: {
        df1: [
          { name: 'species', type: 'factor' },
          { name: 'count', type: 'numeric' },
          { name: 'island', type: 'factor' },
        ],
      },
    };

    const aiResult: AICallResult = {
      success: true,
      plan: {
        goal: 'Bar chart values by species',
        assumptions: [],
        clarificationQuestions: [],
        overallConfidence: 0.9,
        requiresConfirmation: false,
        executionMode: 'component_codegen',
        modeReason: 'dialog available',
        modeConfidence: 0.9,
        steps: [
          {
            stepId: 's1',
            stepType: 'dialog',
            operationId: 'describe.comparison.numeric_by_group',
            dialogId: 'bar-chart',
            dependsOnStepId: undefined,
            state: {
              dataframe: 'df1',
              xVariable: 'species',
              yVariable: 'count',
              fillVariable: 'island',
            },
            inferredFields: ['chartType'],
            confidence: 0.9,
            rationale: 'Value bars compare numeric values across groups',
          },
        ],
      },
    };

    const resolved = resolver.resolve(aiResult, dataContext);
    expect(resolved.ok).toBeTrue();
    const state = resolved.plan?.steps[0].metadata?.state ?? {};
    expect(state['chartType']).toBe('value');
    expect(state['yVariable']).toBe('count');
    expect(resolved.warnings?.some((x) => x.includes('plotting-normalize-bar-chart-state'))).toBeFalse();
  });

  it('rejects bar-chart value mode when yVariable is missing', () => {
    const resolver = new IntentResolverService();
    const dataContext: DataContext = {
      dataframes: ['df1'],
      activeDataframe: 'df1',
      columnsByDataframe: {
        df1: [
          { name: 'species', type: 'factor' },
          { name: 'count', type: 'numeric' },
        ],
      },
    };

    const aiResult: AICallResult = {
      success: true,
      plan: {
        goal: 'Bar chart value mode without y',
        assumptions: [],
        clarificationQuestions: [],
        overallConfidence: 0.9,
        requiresConfirmation: false,
        executionMode: 'component_codegen',
        modeReason: 'dialog available',
        modeConfidence: 0.9,
        steps: [
          {
            stepId: 's1',
            stepType: 'dialog',
            operationId: 'describe.comparison.numeric_by_group',
            dialogId: 'bar-chart',
            dependsOnStepId: undefined,
            state: {
              dataframe: 'df1',
              chartType: 'value',
              xVariable: 'species',
            },
            inferredFields: [],
            confidence: 0.9,
            rationale: 'Intentional invalid payload',
          },
        ],
      },
    };

    const resolved = resolver.resolve(aiResult, dataContext);
    expect(resolved.ok).toBeFalse();
    expect(resolved.error).toContain('Missing required param "yVariable"');
  });
});
