import type { DialogMetadata } from '../r-codegen/dialog-metadata';
import { isKnownDialogId } from './dialog-identity.registry';

/**
 * Builds DialogMetadata from dialogId and state.
 * Returns null if the dialog is not in the identity registry.
 */
export function buildDialogMetadata(
  dialogId: string,
  state: Record<string, unknown>,
  options?: { version?: string; timestamp?: string }
): DialogMetadata | null {
  if (!isKnownDialogId(dialogId)) return null;
  return {
    dialogId,
    version: options?.version ?? '1.0',
    state: state as Record<string, any>,
    timestamp: options?.timestamp ?? new Date().toISOString(),
  };
}
