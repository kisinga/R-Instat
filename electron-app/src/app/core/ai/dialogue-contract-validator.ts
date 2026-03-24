/**
 * Validates DialogueAIContract before registration.
 * Pure function; no dependency on DialogBase or registry.
 * See core/ai/docs/ai-integration.md for flow.
 */

import type { DialogueAIContract } from './current-dialogue-contract';

export interface ContractValidationResult {
  valid: boolean;
  warnings: string[];
}

/**
 * Validates a contract. Required for valid: non-empty id, non-empty name, at least one capability.
 * Optional warnings (e.g. empty description) do not affect valid.
 */
export function validateDialogueAIContract(
  contract: DialogueAIContract
): ContractValidationResult {
  const warnings: string[] = [];
  const descriptor = contract.getDescriptor();

  if (!descriptor.id || String(descriptor.id).trim() === '') {
    warnings.push('id is empty');
  }
  if (!descriptor.name || String(descriptor.name).trim() === '') {
    warnings.push('name is empty');
  }
  if (
    !descriptor.capabilities ||
    !Array.isArray(descriptor.capabilities) ||
    descriptor.capabilities.length < 1
  ) {
    warnings.push('capabilities must have at least one item');
  }
  if (!descriptor.description || String(descriptor.description).trim() === '') {
    warnings.push('description is empty');
  }

  const valid =
    descriptor.id?.trim() !== '' &&
    descriptor.name?.trim() !== '' &&
    Array.isArray(descriptor.capabilities) &&
    descriptor.capabilities.length >= 1;

  return {
    valid,
    warnings,
  };
}
