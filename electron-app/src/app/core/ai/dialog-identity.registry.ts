import { getSchema, getSchemaSummaryForPrompt } from './dialog-schema.registry';
import { DialogContractV2Registry } from './dialog-contract-v2.registry';

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

export function getDialogContractsForPrompt(): Array<{
  dialogId: string;
  componentType: string;
  family?: string;
  description: string;
  operations: string[];
  params: Array<{
    name: string;
    kind: string;
    required?: boolean;
    columnType?: string;
    enumValues?: string[];
    when?: { param: string; equals: string | number | boolean };
  }>;
}> {
  const v2ById = new Map(
    DialogContractV2Registry.getPromptContracts().map((contract) => [contract.dialogId, contract])
  );
  const legacyContracts = getSchemaSummaryForPrompt()
    .map((schema) => {
      if (v2ById.has(schema.dialogId)) {
        return null;
      }
      const componentType = getComponentType(schema.dialogId);
      if (!componentType) {
        return null;
      }
      return {
        ...schema,
        componentType,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const v2Contracts = DialogContractV2Registry.getPromptContracts().map((contract) => ({
    dialogId: contract.dialogId,
    componentType: contract.componentType,
    family: contract.family,
    description: contract.description,
    operations: contract.operations,
    params: contract.params,
  }));

  return [...v2Contracts, ...legacyContracts];
}
