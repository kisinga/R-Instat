/**
 * Current-dialogue contract for AI integration.
 * The dialogue fulfills this contract; the registry consumes it.
 */

export type AICapability =
  | 'provide-r-code'
  | 'suggest-columns'
  | 'explain-options'
  | 'explain-statistics'
  | 'generate-data';

export interface DialogueAIDescriptor {
  id: string;
  name: string;
  description?: string;
  capabilities: readonly AICapability[];
}

export interface DialogueAIContext {
  variables: Record<string, unknown>;
  currentRCode?: string;
}

/** Plain input to build a contract; builder consumes it. */
export interface DialogueContractInput {
  id: string;
  name: string;
  description?: string;
  capabilities?: readonly AICapability[];
  getVariables: () => Record<string, unknown>;
  getRCode: () => string;
}

/** Interface the dialogue fulfills; registry stores and calls it. */
export interface DialogueAIContract {
  getDescriptor(): DialogueAIDescriptor;
  getContext(): DialogueAIContext;
}
