/**
 * OperationSpec Registry
 *
 * Stores and retrieves OperationSpecs for the generic dialog renderer.
 * Also bridges into the AI catalog system via getGenericDialogContracts().
 */

import type { OperationSpec } from './operation-spec';
import type { DialogPromptContract } from '../dialog-catalog';

const specs = new Map<string, OperationSpec>();

export function registerOperationSpec(spec: OperationSpec): void {
  if (specs.has(spec.dialogId)) {
    console.warn(`[GenericDialog] Duplicate spec registration: "${spec.dialogId}"`);
  }
  specs.set(spec.dialogId, spec);
}

export function getOperationSpec(dialogId: string): OperationSpec | undefined {
  return specs.get(dialogId);
}

export function listOperationSpecs(): OperationSpec[] {
  return [...specs.values()];
}

/**
 * Returns DialogPromptContract[] for all registered specs.
 * Used by dialog-catalog-aggregator to merge generic specs into the AI catalog.
 */
export function getGenericDialogContracts(): DialogPromptContract[] {
  return listOperationSpecs().map((spec) => ({
    dialogId: spec.dialogId,
    componentType: 'GenericDialogComponent',
    family: spec.family,
    description: spec.description,
    operations: spec.operations,
    params: spec.params,
    retrievalHints: spec.retrievalHints,
  }));
}
