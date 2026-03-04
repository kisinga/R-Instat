import type { DialogParamSchema } from './dialog-schema.registry';

export type DialogFamily =
  | 'plotting'
  | 'data-preparation'
  | 'inferential'
  | 'predictive'
  | 'climatic'
  | 'other';

export interface DialogContractV2 {
  dialogId: string;
  componentType: string;
  family: DialogFamily;
  description: string;
  operations: string[];
  params: DialogParamSchema[];
  retrievalHints: {
    keywords: string[];
  };
  migration: {
    parityStatus: 'pilot' | 'in-progress' | 'complete';
    parityArtifactPath?: string;
  };
}

export interface DialogPromptContractV2 {
  dialogId: string;
  componentType: string;
  family: DialogFamily;
  description: string;
  operations: string[];
  params: DialogParamSchema[];
  retrievalHints: {
    keywords: string[];
  };
}
