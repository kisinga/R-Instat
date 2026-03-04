/**
 * Planner context builders (pure functions).
 * Compose scoped operations and compact contract views to keep planner payload minimal.
 */

import type { OperationDefinition } from './operation-registry';
import type { DialogPromptContract } from './dialog-catalog';
import type { DialogSchema } from './dialog-schema.registry';

export interface PlanningContractView {
  dialogId: string;
  description: string;
  operations: string[];
  paramNames: string[];
}

/**
 * Filter operations to those whose mappedDialogs intersect scopedDialogIds.
 * Pure; no I/O.
 */
export function filterOperationsForScopedDialogs(
  operations: OperationDefinition[],
  scopedDialogIds: string[]
): OperationDefinition[] {
  const idSet = new Set(scopedDialogIds);
  return operations.filter((op) =>
    op.mappedDialogs.some((dialogId) => idSet.has(dialogId))
  );
}

/**
 * Build compact contract views for the planner: dialogId, description, operations, paramNames.
 * Param names come from getSchema (dialog-catalog-aggregator).
 */
export function buildPlanningContractViews(
  contracts: DialogPromptContract[],
  getSchema: (dialogId: string) => DialogSchema | undefined
): PlanningContractView[] {
  return contracts.map((c) => {
    const schema = getSchema(c.dialogId);
    const paramNames = schema ? schema.params.map((p) => p.name) : [];
    return {
      dialogId: c.dialogId,
      description: c.description,
      operations: c.operations,
      paramNames,
    };
  });
}
