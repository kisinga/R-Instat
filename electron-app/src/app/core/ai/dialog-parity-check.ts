import { DIALOG_SCHEMAS } from './dialog-schema.registry';
import { OPERATION_REGISTRY } from './operation-registry';
import { listDialogIds } from './dialog-identity.registry';
import { DialogContractV2Registry } from './dialog-contract-v2.registry';
import { DIALOG_PARITY_EVIDENCE } from './dialog-parity-evidence.registry';

export interface ParityConsistencyReport {
  hostWithoutSchema: string[];
  schemaWithoutHost: string[];
  operationWithoutSchema: string[];
  operationWithoutHost: string[];
  schemaWithoutOperation: string[];
  v2WithoutSchema: string[];
  v2WithoutOperation: string[];
  v2WithoutHost: string[];
  parityEvidenceMissingForV2: string[];
  ok: boolean;
}

/**
 * Verifies contract consistency across host dialogs, schema definitions,
 * and operation mappings. This is intentionally strict to catch regressions
 * where AI plans target dialogs that cannot be opened/configured safely.
 */
export function buildParityConsistencyReport(): ParityConsistencyReport {
  const hostDialogs = new Set(listDialogIds({ includeNonAnalytical: false }));
  const schemaDialogs = new Set(DIALOG_SCHEMAS.map((s) => s.dialogId));
  const operationDialogs = new Set(OPERATION_REGISTRY.flatMap((o) => o.mappedDialogs));
  const v2Dialogs = new Set(DialogContractV2Registry.list().map((c) => c.dialogId));
  const parityEvidenceDialogs = new Set(
    DIALOG_PARITY_EVIDENCE.filter((x) => x.status === 'complete').map((x) => x.dialogId)
  );

  const hostWithoutSchema = [...hostDialogs].filter((dialogId) => !schemaDialogs.has(dialogId)).sort();
  const schemaWithoutHost = [...schemaDialogs].filter((dialogId) => !hostDialogs.has(dialogId)).sort();
  const operationWithoutSchema = [...operationDialogs].filter((dialogId) => !schemaDialogs.has(dialogId)).sort();
  const operationWithoutHost = [...operationDialogs].filter((dialogId) => !hostDialogs.has(dialogId)).sort();
  const schemaWithoutOperation = [...schemaDialogs].filter((dialogId) => !operationDialogs.has(dialogId)).sort();
  const v2WithoutSchema = [...v2Dialogs].filter((dialogId) => !schemaDialogs.has(dialogId)).sort();
  const v2WithoutOperation = [...v2Dialogs].filter((dialogId) => !operationDialogs.has(dialogId)).sort();
  const v2WithoutHost = [...v2Dialogs].filter((dialogId) => !hostDialogs.has(dialogId)).sort();
  const parityEvidenceMissingForV2 = [...v2Dialogs]
    .filter((dialogId) => !parityEvidenceDialogs.has(dialogId))
    .sort();

  return {
    hostWithoutSchema,
    schemaWithoutHost,
    operationWithoutSchema,
    operationWithoutHost,
    schemaWithoutOperation,
    v2WithoutSchema,
    v2WithoutOperation,
    v2WithoutHost,
    parityEvidenceMissingForV2,
    ok:
      hostWithoutSchema.length === 0 &&
      schemaWithoutHost.length === 0 &&
      operationWithoutSchema.length === 0 &&
      operationWithoutHost.length === 0 &&
      schemaWithoutOperation.length === 0 &&
      v2WithoutSchema.length === 0 &&
      v2WithoutOperation.length === 0 &&
      v2WithoutHost.length === 0 &&
      parityEvidenceMissingForV2.length === 0,
  };
}
