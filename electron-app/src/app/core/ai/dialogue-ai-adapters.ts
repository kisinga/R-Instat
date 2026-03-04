/**
 * Composable adapters for derivable dialogue AI data.
 * Depend only on contract types; used by DialogBase and others to build DialogueAIContract.
 */

import type {
  AICapability,
  DialogueAIDescriptor,
  DialogueAIContext,
  DialogueAIContract,
  DialogueContractInput,
} from './current-dialogue-contract';

const DEFAULT_CAPABILITIES: readonly AICapability[] = ['provide-r-code'];

export function createDefaultDescriptor(
  id: string,
  name: string,
  options?: { description?: string; capabilities?: AICapability[] }
): DialogueAIDescriptor {
  return {
    id,
    name,
    description: options?.description ?? '',
    capabilities: options?.capabilities ?? [...DEFAULT_CAPABILITIES],
  };
}

export function createDefaultContextProvider(
  getVariables: () => Record<string, unknown>,
  getRCode: () => string
): () => DialogueAIContext {
  return () => ({
    variables: getVariables(),
    currentRCode: getRCode() || undefined,
  });
}

export function createDialogBaseAIContract(
  descriptor: DialogueAIDescriptor,
  getVariables: () => Record<string, unknown>,
  getRCode: () => string
): DialogueAIContract {
  return {
    getDescriptor: () => descriptor,
    getContext: () => ({
      variables: getVariables(),
      currentRCode: getRCode() || undefined,
    }),
  };
}

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
