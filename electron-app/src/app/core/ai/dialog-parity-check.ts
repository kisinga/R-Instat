import { getDialogRegistryView } from './dialog-registry-view';

export interface ParityConsistencyReport {
  hostWithoutSchema: string[];
  schemaWithoutHost: string[];
  operationWithoutSchema: string[];
  operationWithoutHost: string[];
  schemaWithoutOperation: string[];
  catalogWithoutSchema: string[];
  catalogWithoutOperation: string[];
  catalogWithoutHost: string[];
  parityEvidenceMissingForCatalog: string[];
  ok: boolean;
}

/**
 * Verifies contract consistency across host dialogs, schema definitions,
 * and operation mappings. Inferred from the single dialog registry view.
 */
export function buildParityConsistencyReport(): ParityConsistencyReport {
  const view = getDialogRegistryView();
  const { hostIds, schemaIds, operationIds, catalogIds, parityEvidenceIds, allIds } = view;

  const hostWithoutSchema: string[] = [];
  const schemaWithoutHost: string[] = [];
  const operationWithoutSchema: string[] = [];
  const operationWithoutHost: string[] = [];
  const schemaWithoutOperation: string[] = [];
  const catalogWithoutSchema: string[] = [];
  const catalogWithoutOperation: string[] = [];
  const catalogWithoutHost: string[] = [];
  const parityEvidenceMissingForCatalog: string[] = [];

  for (const dialogId of allIds) {
    const inHost = hostIds.has(dialogId);
    const inSchema = schemaIds.has(dialogId);
    const inOperation = operationIds.has(dialogId);
    const inCatalog = catalogIds.has(dialogId);
    const inParityEvidence = parityEvidenceIds.has(dialogId);

    if (inHost && !inSchema) hostWithoutSchema.push(dialogId);
    if (inSchema && !inHost) schemaWithoutHost.push(dialogId);
    if (inOperation && !inSchema) operationWithoutSchema.push(dialogId);
    if (inOperation && !inHost) operationWithoutHost.push(dialogId);
    if (inSchema && !inOperation) schemaWithoutOperation.push(dialogId);
    if (inCatalog && !inSchema) catalogWithoutSchema.push(dialogId);
    if (inCatalog && !inOperation) catalogWithoutOperation.push(dialogId);
    if (inCatalog && !inHost) catalogWithoutHost.push(dialogId);
    if (inCatalog && !inParityEvidence) parityEvidenceMissingForCatalog.push(dialogId);
  }

  const sort = (a: string[]) => a.slice().sort();
  return {
    hostWithoutSchema: sort(hostWithoutSchema),
    schemaWithoutHost: sort(schemaWithoutHost),
    operationWithoutSchema: sort(operationWithoutSchema),
    operationWithoutHost: sort(operationWithoutHost),
    schemaWithoutOperation: sort(schemaWithoutOperation),
    catalogWithoutSchema: sort(catalogWithoutSchema),
    catalogWithoutOperation: sort(catalogWithoutOperation),
    catalogWithoutHost: sort(catalogWithoutHost),
    parityEvidenceMissingForCatalog: sort(parityEvidenceMissingForCatalog),
    ok:
      hostWithoutSchema.length === 0 &&
      schemaWithoutHost.length === 0 &&
      operationWithoutSchema.length === 0 &&
      operationWithoutHost.length === 0 &&
      schemaWithoutOperation.length === 0 &&
      catalogWithoutSchema.length === 0 &&
      catalogWithoutOperation.length === 0 &&
      catalogWithoutHost.length === 0 &&
      parityEvidenceMissingForCatalog.length === 0,
  };
}
