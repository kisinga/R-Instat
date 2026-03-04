import { getDialogRegistryView } from './dialog-registry-view';

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
 * and operation mappings. Inferred from the single dialog registry view.
 */
export function buildParityConsistencyReport(): ParityConsistencyReport {
  const view = getDialogRegistryView();
  const { hostIds, schemaIds, operationIds, v2Ids, parityEvidenceIds, allIds } = view;

  const hostWithoutSchema: string[] = [];
  const schemaWithoutHost: string[] = [];
  const operationWithoutSchema: string[] = [];
  const operationWithoutHost: string[] = [];
  const schemaWithoutOperation: string[] = [];
  const v2WithoutSchema: string[] = [];
  const v2WithoutOperation: string[] = [];
  const v2WithoutHost: string[] = [];
  const parityEvidenceMissingForV2: string[] = [];

  for (const dialogId of allIds) {
    const inHost = hostIds.has(dialogId);
    const inSchema = schemaIds.has(dialogId);
    const inOperation = operationIds.has(dialogId);
    const inV2 = v2Ids.has(dialogId);
    const inParityEvidence = parityEvidenceIds.has(dialogId);

    if (inHost && !inSchema) hostWithoutSchema.push(dialogId);
    if (inSchema && !inHost) schemaWithoutHost.push(dialogId);
    if (inOperation && !inSchema) operationWithoutSchema.push(dialogId);
    if (inOperation && !inHost) operationWithoutHost.push(dialogId);
    if (inSchema && !inOperation) schemaWithoutOperation.push(dialogId);
    if (inV2 && !inSchema) v2WithoutSchema.push(dialogId);
    if (inV2 && !inOperation) v2WithoutOperation.push(dialogId);
    if (inV2 && !inHost) v2WithoutHost.push(dialogId);
    if (inV2 && !inParityEvidence) parityEvidenceMissingForV2.push(dialogId);
  }

  const sort = (a: string[]) => a.slice().sort();
  return {
    hostWithoutSchema: sort(hostWithoutSchema),
    schemaWithoutHost: sort(schemaWithoutHost),
    operationWithoutSchema: sort(operationWithoutSchema),
    operationWithoutHost: sort(operationWithoutHost),
    schemaWithoutOperation: sort(schemaWithoutOperation),
    v2WithoutSchema: sort(v2WithoutSchema),
    v2WithoutOperation: sort(v2WithoutOperation),
    v2WithoutHost: sort(v2WithoutHost),
    parityEvidenceMissingForV2: sort(parityEvidenceMissingForV2),
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
