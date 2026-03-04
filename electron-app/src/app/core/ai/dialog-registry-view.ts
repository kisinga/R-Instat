/**
 * Dialog Registry View
 *
 * Single place that answers "which dialogIds exist in host / schema / operation / v2 / parityEvidence?"
 * Used by parity check and capability inventory to avoid duplicated set-building logic.
 */

import { DIALOG_SCHEMAS } from './dialog-schema.registry';
import { OPERATION_REGISTRY } from './operation-registry';
import { listDialogIds } from './dialog-identity.registry';
import { DialogContractV2Registry } from './dialog-contract-v2.registry';
import { DIALOG_PARITY_EVIDENCE } from './dialog-parity-evidence.registry';

export interface DialogRegistryView {
  hostIds: Set<string>;
  schemaIds: Set<string>;
  operationIds: Set<string>;
  v2Ids: Set<string>;
  parityEvidenceIds: Set<string>;
  allIds: Set<string>;
}

let cachedView: DialogRegistryView | null = null;

function buildView(): DialogRegistryView {
  const hostIds = new Set(listDialogIds({ includeNonAnalytical: false }));
  const schemaIds = new Set(DIALOG_SCHEMAS.map((s) => s.dialogId));
  const operationIds = new Set(OPERATION_REGISTRY.flatMap((o) => o.mappedDialogs));
  const v2Ids = new Set(DialogContractV2Registry.list().map((c) => c.dialogId));
  const parityEvidenceIds = new Set(
    DIALOG_PARITY_EVIDENCE.filter((x) => x.status === 'complete').map((x) => x.dialogId)
  );
  const allIds = new Set<string>([
    ...hostIds,
    ...schemaIds,
    ...operationIds,
    ...v2Ids,
    ...parityEvidenceIds,
  ]);
  return {
    hostIds,
    schemaIds,
    operationIds,
    v2Ids,
    parityEvidenceIds,
    allIds,
  };
}

/**
 * Returns the dialog registry view. Cached so parity and capability share one build.
 */
export function getDialogRegistryView(): DialogRegistryView {
  if (cachedView === null) {
    cachedView = buildView();
  }
  return cachedView;
}

/**
 * Dialogs with deterministic R builders available in current codegen layer.
 * Single constant for capability inventory (and any other consumers).
 */
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
