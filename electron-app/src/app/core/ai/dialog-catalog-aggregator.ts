import type { DialogPromptContract } from './dialog-catalog';
import type { DialogSchema } from './dialog-schema.registry';
import { validateCatalogDescriptor } from './dialog-catalog-validator';
import { AIDialogClassRegistry } from './dialog-class-registry';
import { DialogBase } from '../../features/dialogs/dialog-base';

let cachedCatalog: DialogPromptContract[] | null = null;

/**
 * Builds the catalog from dialog classes. Pure function; no caching inside.
 * Skips classes that return null or fail validation (with console.warn).
 */
export function buildCatalogFromDialogs(
  classes: (typeof DialogBase)[]
): DialogPromptContract[] {
  const result: DialogPromptContract[] = [];
  for (const Cls of classes) {
    const descriptor = (Cls as typeof DialogBase & {
      getCatalogDescriptor(): DialogPromptContract | null;
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
export function getDialogContractsForPrompt(): DialogPromptContract[] {
  if (cachedCatalog === null) {
    cachedCatalog = buildCatalogFromDialogs(AIDialogClassRegistry.getRegisteredClasses() as (typeof DialogBase)[]);
  }
  return cachedCatalog;
}

/**
 * Returns the full catalog contract for a dialog by dialogId, or undefined.
 */
export function getCatalogContract(dialogId: string): DialogPromptContract | undefined {
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
