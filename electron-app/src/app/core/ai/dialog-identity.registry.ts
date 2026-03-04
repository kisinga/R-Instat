import { DIALOG_SCHEMAS, getSchema } from './dialog-schema.registry';
import { DialogContractV2Registry } from './dialog-contract-v2.registry';
import type { DialogFamily, DialogPromptContractV2 } from './dialog-contract-v2';
import { OPERATION_REGISTRY } from './operation-registry';

const LEGACY_DIALOG_ID_TO_COMPONENT: Readonly<Record<string, string>> = {
  'import': 'ImportDialogComponent',
  'summary': 'SummaryDialogComponent',
  'histogram': 'HistogramDialogComponent',
  'boxplot': 'BoxplotDialogComponent',
  'scatter': 'ScatterDialogComponent',
  'bar-chart': 'BarChartDialogComponent',
  'filter': 'FilterDialogComponent',
  'sort': 'SortDialogComponent',
  'calculate': 'CalculateDialogComponent',
  'recode': 'RecodeDialogComponent',
  'rename': 'RenameDialogComponent',
  'correlation': 'CorrelationDialogComponent',
  't-test': 'TTestDialogComponent',
  'regression': 'RegressionDialogComponent',
  'describe': 'DescribeDialogComponent',
  'describe:summary': 'SummaryDialogComponent',
  'describe:graph': 'DescribeDialogComponent',
  'domain-selector': 'DomainSelectorComponent',
  'define-climatic-data': 'DefineClimaticDataDialogComponent',
  'climatic-summary': 'ClimaticSummaryDialogComponent',
  'inventory-plot': 'InventoryPlotDialogComponent',
  'annual-rainfall': 'AnnualRainfallDialogComponent',
  'extremes': 'ExtremesDialogComponent',
  'day-count': 'DayCountDialogComponent',
  'spell-lengths': 'SpellLengthsDialogComponent',
  'seasonal-summary': 'SeasonalSummaryDialogComponent',
  'missing-report': 'MissingReportDialogComponent',
  'temperature-summary': 'TemperatureSummaryDialogComponent',
  'export': 'ExportDialogComponent',
  'merge': 'MergeDialogComponent',
  'stack': 'StackDialogComponent',
  'unstack': 'UnstackDialogComponent',
  'line-plot': 'LinePlotDialogComponent',
  'dot-plot': 'DotPlotDialogComponent',
  'restore-from-code': 'RestoreFromCodeDialogComponent',
  'ai-assist': 'AIAssistDialogComponent',
};

export const DIALOG_ID_TO_COMPONENT: Readonly<Record<string, string>> =
  DialogContractV2Registry.applyIdentityMappings(LEGACY_DIALOG_ID_TO_COMPONENT);

const COMPONENT_TO_DIALOG_ID = new Map<string, string>();
for (const [dialogId, componentType] of Object.entries(DIALOG_ID_TO_COMPONENT)) {
  if (!COMPONENT_TO_DIALOG_ID.has(componentType)) {
    COMPONENT_TO_DIALOG_ID.set(componentType, dialogId);
  }
}

const NON_ANALYTICAL_DIALOGS = new Set<string>([
  'import',
  'export',
  'domain-selector',
  'restore-from-code',
  'ai-assist',
]);

function normalizeComponentType(componentType: string): string {
  return componentType.startsWith('_') ? componentType.slice(1) : componentType;
}

export function getComponentType(dialogId: string): string | undefined {
  return DIALOG_ID_TO_COMPONENT[dialogId];
}

export function getDialogId(componentType: string): string | null {
  const normalized = normalizeComponentType(componentType);
  return COMPONENT_TO_DIALOG_ID.get(normalized) ?? null;
}

export function isKnownDialogId(dialogId: string): boolean {
  return Object.prototype.hasOwnProperty.call(DIALOG_ID_TO_COMPONENT, dialogId);
}

export function listDialogIds(opts: { includeNonAnalytical?: boolean } = {}): string[] {
  const { includeNonAnalytical = true } = opts;
  const dialogIds = Object.keys(DIALOG_ID_TO_COMPONENT);
  if (includeNonAnalytical) {
    return dialogIds;
  }
  return dialogIds.filter((dialogId) => !NON_ANALYTICAL_DIALOGS.has(dialogId));
}

export function getDialogContract(dialogId: string): {
  dialogId: string;
  componentType: string;
  schema: ReturnType<typeof getSchema>;
} | null {
  const componentType = getComponentType(dialogId);
  if (!componentType) {
    return null;
  }
  return {
    dialogId,
    componentType,
    schema: getSchema(dialogId),
  };
}

/**
 * Infer DialogFamily from operation registry when no V2 overlay exists.
 */
function inferFamilyForDialog(dialogId: string): DialogFamily {
  const op = OPERATION_REGISTRY.find((o) => o.mappedDialogs.includes(dialogId));
  if (!op) return 'other';
  const d = op.derivedKind as string;
  if (d.startsWith('climatic')) return 'climatic';
  switch (op.primaryKind) {
    case 'data-preparation':
      return 'data-preparation';
    case 'inferential':
      return 'inferential';
    case 'predictive':
      return 'predictive';
    case 'descriptive':
      return 'plotting';
    default:
      return 'other';
  }
}

/**
 * Single path for prompt contracts: every dialog with a schema and host component.
 * V2 overlay supplies family and retrievalHints when present; otherwise inferred or default.
 */
export function getDialogContractsForPrompt(): DialogPromptContractV2[] {
  const result: DialogPromptContractV2[] = [];
  for (const schema of DIALOG_SCHEMAS) {
    const componentType = getComponentType(schema.dialogId);
    if (!componentType) continue;
    const overlay = DialogContractV2Registry.get(schema.dialogId);
    result.push({
      dialogId: schema.dialogId,
      componentType,
      family: overlay?.family ?? inferFamilyForDialog(schema.dialogId),
      description: schema.description,
      operations: schema.operations,
      params: schema.params,
      retrievalHints: overlay?.retrievalHints ?? { keywords: [] },
    });
  }
  return result;
}
