import type { DialogMetadata } from '../r-codegen/dialog-metadata';
import { getDialogContract } from './dialog-identity.registry';

/**
 * Builds DialogMetadata from dialogId and state by resolving componentType from the catalog.
 * Returns null if the dialog is not in identity/catalog.
 */
export function buildDialogMetadata(
  dialogId: string,
  state: Record<string, unknown>,
  options?: { version?: string; timestamp?: string }
): DialogMetadata | null {
  const contract = getDialogContract(dialogId);
  if (!contract) return null;
  return {
    dialogId,
    componentType: contract.componentType,
    version: options?.version ?? '1.0',
    state: state as Record<string, any>,
    timestamp: options?.timestamp ?? new Date().toISOString(),
  };
}
