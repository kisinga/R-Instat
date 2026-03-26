import type { DialogParamSchema } from './dialog-schema.registry';
import type { RGenDescriptor } from './generic-dialog/portable-dialog-spec';

export type DialogFamily =
  | 'plotting'
  | 'data-preparation'
  | 'inferential'
  | 'predictive'
  | 'climatic'
  | 'other';

/**
 * DialogContract — Single source of truth for a dialog definition.
 *
 * Used by:
 * - Generic dialog renderer (renders form from params)
 * - Custom dialog components (getCatalogDescriptor return type)
 * - AI pipeline (prompt grounding, validation, retrieval)
 * - Intent resolver (validates AI-produced state against params)
 * - Metadata builder (embeds dialogId in R code for restore)
 */
export interface DialogContract {
  dialogId: string;
  componentType: string;
  title: string;
  family: DialogFamily;
  description: string;
  operations: string[];
  params: DialogParamSchema[];
  retrievalHints: { keywords: string[] };

  /** Builder ID from the builder registry. Used for R code generation. */
  builderId?: string;

  /** Declarative R code generation descriptor (from JSON specs). */
  rGen?: RGenDescriptor;

  /** Raw R code with {{param}} placeholders (escape hatch for imported dialogs). */
  rCode?: string;

  /** Optional custom validation. Return null if valid, error message if invalid. */
  validate?: (state: Record<string, unknown>) => string | null;
}

/** Derived schema view for validation contexts that don't need full contract. */
export type DialogSchema = Pick<DialogContract, 'dialogId' | 'description' | 'operations' | 'params'>;
