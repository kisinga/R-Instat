import { getDialogRegistryView, TEMPLATE_CODEGEN_DIALOG_IDS } from './dialog-registry-view';

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

/** Re-export for consumers (e.g. ai-client.service). */
export { TEMPLATE_CODEGEN_DIALOG_IDS };

/** Host dialog IDs (analytical only), derived from registry view. */
export const HOST_DIALOG_IDS: string[] = (() => {
  const view = getDialogRegistryView();
  return [...view.hostIds].sort();
})();

export function buildCapabilityInventory(): CapabilityInventory {
  const view = getDialogRegistryView();
  const { hostIds, schemaIds, operationIds } = view;

  const rows: DialogCapabilityRow[] = [];
  for (const dialogId of hostIds) {
    const inSchema = schemaIds.has(dialogId);
    const inOperationMapping = operationIds.has(dialogId);
    const hasTemplateBuilder = TEMPLATE_CODEGEN_DIALOG_IDS.has(dialogId);
    let status: CapabilityStatus = 'uncovered';
    if (inSchema && inOperationMapping) {
      status = 'covered-dialog';
    } else if (hasTemplateBuilder) {
      status = 'covered-codegen';
    }
    rows.push({
      dialogId,
      inHost: true,
      inSchema,
      inOperationMapping,
      hasTemplateBuilder,
      status,
    });
  }
  rows.sort((a, b) => a.dialogId.localeCompare(b.dialogId));

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
