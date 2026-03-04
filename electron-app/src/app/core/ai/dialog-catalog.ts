import type { DialogParamSchema } from './dialog-schema.registry';

export type DialogFamily =
  | 'plotting'
  | 'data-preparation'
  | 'inferential'
  | 'predictive'
  | 'climatic'
  | 'other';

/** Full catalog contract (schema + family + retrieval hints + migration). */
export interface DialogCatalogContract {
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

/** Contract shape used for prompt/retrieval (no migration). */
export interface DialogPromptContract {
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
