import type { DialogContract } from './dialog-catalog';
import type { DialogSchema } from './dialog-schema.registry';
import { validateCatalogDescriptor } from './dialog-catalog-validator';
import { AIDialogClassRegistry } from './dialog-class-registry';
import { DialogBase } from '../../features/dialogs/dialog-base';
import { getGenericDialogContracts } from './generic-dialog/operation-spec.registry';

let cachedCatalog: DialogContract[] | null = null;

// Invalidate catalog cache when new dialog classes register
AIDialogClassRegistry.onClassesChanged(() => {
  cachedCatalog = null;
});

/**
 * Builds the catalog from dialog classes. Pure function; no caching inside.
 * Skips classes that return null or fail validation (with console.warn).
 */
export function buildCatalogFromDialogs(
  classes: (typeof DialogBase)[]
): DialogContract[] {
  const result: DialogContract[] = [];
  for (const Cls of classes) {
    const descriptor = (Cls as typeof DialogBase & {
      getCatalogDescriptor(): DialogContract | null;
    }).getCatalogDescriptor();
    if (descriptor === null) {
      continue;
    }
    const { valid, warnings } = validateCatalogDescriptor(descriptor);
    if (!valid) {
      console.warn(
        `[AI Catalog] Dialog "${descriptor.dialogId}" not in catalog:`,
        warnings
      );
      continue;
    }
    result.push(descriptor);
  }
  return result;
}

/**
 * Returns the list of prompt contracts for all valid dialogs. Cached on first access.
 */
export function getDialogContractsForPrompt(): DialogContract[] {
  if (cachedCatalog === null) {
    cachedCatalog = [
      ...buildCatalogFromDialogs(AIDialogClassRegistry.getRegisteredClasses() as (typeof DialogBase)[]),
      ...getGenericDialogContracts(),
    ];
  }
  return cachedCatalog;
}

/**
 * Returns the full catalog contract for a dialog by dialogId, or undefined.
 */
export function getCatalogContract(dialogId: string): DialogContract | undefined {
  return getDialogContractsForPrompt().find((c) => c.dialogId === dialogId);
}

/**
 * Returns schema for a dialog by dialogId from the catalog. Single source of truth.
 */
export function getSchema(dialogId: string): DialogSchema | undefined {
  const contract = getCatalogContract(dialogId);
  if (!contract) return undefined;
  return {
    dialogId: contract.dialogId,
    description: contract.description,
    operations: contract.operations,
    params: contract.params,
  };
}
