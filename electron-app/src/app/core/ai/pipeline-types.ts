/**
 * Types for the AI pipeline (Categorize → Scope → Plan).
 */

import type { DialogFamily } from './dialog-contract-v2';

export type PromptCategory =
  | 'open_dialog'
  | 'refine_current_dialog'
  | 'run_code'
  | 'education_question'
  | 'data_quality_recipe'
  | 'unclear';

export interface CategorizerResult {
  category: PromptCategory;
  family?: DialogFamily;
}

/** Strategy returns null when it has no decision; orchestrator tries next strategy. */
export type CategorizerStrategy = (
  input: string,
  hasCurrentDialog: boolean
) => CategorizerResult | null;
