import type { DialogContract } from './dialog-catalog';

export interface CatalogValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validates a catalog descriptor. Used only by the catalog aggregator.
 * Required for valid: non-empty dialogId, componentType, family, description,
 * operations.length >= 1, params array, retrievalHints.keywords array.
 */
export function validateCatalogDescriptor(
  descriptor: DialogContract | null
): CatalogValidationResult {
  const warnings: string[] = [];
  if (descriptor === null) {
    return { valid: false, warnings: ['descriptor is null'] };
  }

  if (!descriptor.dialogId || String(descriptor.dialogId).trim() === '') {
    warnings.push('dialogId is empty');
  }
  if (!descriptor.componentType || String(descriptor.componentType).trim() === '') {
    warnings.push('componentType is empty');
  }
  if (!descriptor.family || String(descriptor.family).trim() === '') {
    warnings.push('family is empty');
  }
  if (!descriptor.description || String(descriptor.description).trim() === '') {
    warnings.push('description is empty');
  }
  if (
    !Array.isArray(descriptor.operations) ||
    descriptor.operations.length < 1
  ) {
    warnings.push('operations must have at least one item');
  }
  if (!Array.isArray(descriptor.params)) {
    warnings.push('params must be an array');
  }
  if (
    !descriptor.retrievalHints ||
    !Array.isArray(descriptor.retrievalHints.keywords)
  ) {
    warnings.push('retrievalHints.keywords must be an array');
  }

  const valid =
    (descriptor.dialogId?.trim() ?? '') !== '' &&
    (descriptor.componentType?.trim() ?? '') !== '' &&
    (descriptor.family?.trim() ?? '') !== '' &&
    (descriptor.description?.trim() ?? '') !== '' &&
    Array.isArray(descriptor.operations) &&
    descriptor.operations.length >= 1 &&
    Array.isArray(descriptor.params) &&
    descriptor.retrievalHints != null &&
    Array.isArray(descriptor.retrievalHints.keywords);

  return { valid, warnings };
}
