/**
 * Generic Dialog Registry
 *
 * Stores and retrieves DialogContract specs for the generic dialog renderer.
 * Specs registered here are automatically merged into the AI catalog.
 * Change listeners allow dependent caches to invalidate on registration.
 */

import type { DialogContract } from '../dialog-catalog';

const specs = new Map<string, DialogContract>();
const changeListeners: Array<() => void> = [];

/** Register a callback that fires when specs are added or removed. */
export function onSpecsChanged(cb: () => void): void {
  changeListeners.push(cb);
}

function notifyChange(): void {
  for (const cb of changeListeners) cb();
}

export function registerDialogSpec(spec: DialogContract): void {
  if (specs.has(spec.dialogId)) {
    console.warn(`[GenericDialog] Duplicate spec registration: "${spec.dialogId}"`);
  }
  specs.set(spec.dialogId, spec);
  notifyChange();
}

export function unregisterDialogSpec(dialogId: string): boolean {
  const removed = specs.delete(dialogId);
  if (removed) notifyChange();
  return removed;
}

export function getDialogSpec(dialogId: string): DialogContract | undefined {
  return specs.get(dialogId);
}

export function listDialogSpecs(): DialogContract[] {
  return [...specs.values()];
}

/** @deprecated Use registerDialogSpec */
export const registerOperationSpec = registerDialogSpec;
/** @deprecated Use getDialogSpec */
export const getOperationSpec = getDialogSpec;
/** @deprecated Use listDialogSpecs */
export const listOperationSpecs = listDialogSpecs;

/**
 * Returns all registered generic dialog contracts.
 * Used by dialog-catalog-aggregator to merge into the AI catalog.
 */
export function getGenericDialogContracts(): DialogContract[] {
  return listDialogSpecs();
}
