/**
 * Composable adapter: builds DialogueAIContract from plain input.
 * Single path for DialogBase and non-DialogBase dialogs (Describe, Import).
 */

import type {
  DialogueAIDescriptor,
  DialogueAIContext,
  DialogueAIContract,
  DialogueContractInput,
} from './current-dialogue-contract';

/**
 * Builds a DialogueAIContract from plain input. Normalizes optional fields; no validation.
 */
export function buildDialogueAIContract(
  input: DialogueContractInput
): DialogueAIContract {
  const descriptor: DialogueAIDescriptor = {
    id: input.id,
    name: input.name,
    description: input.description ?? '',
    capabilities: input.capabilities ?? [],
  };
  return {
    getDescriptor: () => descriptor,
    getContext: (): DialogueAIContext => ({
      variables: input.getVariables(),
      currentRCode: input.getRCode() || undefined,
    }),
  };
}
