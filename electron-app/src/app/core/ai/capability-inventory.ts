import { DIALOG_SCHEMAS } from './dialog-schema.registry';
import { OPERATION_REGISTRY } from './operation-registry';
import { listDialogIds } from './dialog-identity.registry';

export type CapabilityStatus = 'covered-dialog' | 'covered-codegen' | 'uncovered';

export interface DialogCapabilityRow {
  dialogId: string;
  inHost: boolean;
  inSchema: boolean;
  inOperationMapping: boolean;
  hasTemplateBuilder: boolean;
  status: CapabilityStatus;
}

export interface CapabilityInventory {
  rows: DialogCapabilityRow[];
  summary: {
    totalHostDialogs: number;
    coveredDialog: number;
    coveredCodegen: number;
    uncovered: number;
  };
}

// Mirrors the set exposed by DialogHost while excluding non-analytical shell dialogs.
export const HOST_DIALOG_IDS: string[] = listDialogIds({ includeNonAnalytical: false });

// Dialogs with deterministic R builders available in current codegen layer.
export const TEMPLATE_CODEGEN_DIALOG_IDS = new Set<string>([
  'bar-chart',
  'histogram',
  'boxplot',
  'scatter',
  'calculate',
  'rename',
  'recode',
  'sort',
  'correlation',
  't-test',
  'regression',
]);

export function buildCapabilityInventory(): CapabilityInventory {
  const schemaDialogs = new Set(DIALOG_SCHEMAS.map((d) => d.dialogId));
  const mappedDialogs = new Set(OPERATION_REGISTRY.flatMap((o) => o.mappedDialogs));

  const rows = HOST_DIALOG_IDS.map((dialogId) => {
    const inSchema = schemaDialogs.has(dialogId);
    const inOperationMapping = mappedDialogs.has(dialogId);
    const hasTemplateBuilder = TEMPLATE_CODEGEN_DIALOG_IDS.has(dialogId);
    let status: CapabilityStatus = 'uncovered';

    if (inSchema && inOperationMapping) {
      status = 'covered-dialog';
    } else if (hasTemplateBuilder) {
      status = 'covered-codegen';
    }

    return {
      dialogId,
      inHost: true,
      inSchema,
      inOperationMapping,
      hasTemplateBuilder,
      status,
    };
  });

  return {
    rows,
    summary: {
      totalHostDialogs: rows.length,
      coveredDialog: rows.filter((r) => r.status === 'covered-dialog').length,
      coveredCodegen: rows.filter((r) => r.status === 'covered-codegen').length,
      uncovered: rows.filter((r) => r.status === 'uncovered').length,
    },
  };
}
