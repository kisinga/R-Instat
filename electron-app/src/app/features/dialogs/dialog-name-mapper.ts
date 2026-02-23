/**
 * Dialog Name Mapper
 * 
 * Maps component type names to dialog IDs for restoration.
 */

import { getDialogId } from '../../core/ai/dialog-identity.registry';

/**
 * Map component type name to dialog ID
 */
export function mapComponentTypeToDialogId(componentType: string): string | null {
  return getDialogId(componentType);
}
