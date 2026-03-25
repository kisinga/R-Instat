/**
 * OperationSpec — Declarative dialog definition for the generic renderer.
 *
 * An OperationSpec describes a statistical operation as pure data:
 * schema (params), identity (dialogId, family, operations), and retrieval hints.
 *
 * R code generation is handled by `compileStepToR()` in step-to-r.ts,
 * which dispatches to strongly-typed builders. The spec does NOT contain
 * a builder reference — this keeps the type boundary clean.
 *
 * @see {@link compileStepToR} for the untyped-state → typed-builder adapter
 * @see {@link DialogParamSchema} for the param definition type
 */

import type { DialogFamily } from '../dialog-catalog';
import type { DialogParamSchema } from '../dialog-schema.registry';

export interface OperationSpec {
  /** Unique dialog identifier — must match the case in compileStepToR */
  dialogId: string;

  /** Human-readable title shown in the dialog header */
  title: string;

  /** Dialog family for AI categorization */
  family: DialogFamily;

  /** Short description for AI prompts and tooltips */
  description: string;

  /** Operation IDs this spec maps to (from operation-registry taxonomy) */
  operations: string[];

  /** Parameter schema — drives form rendering and validation */
  params: DialogParamSchema[];

  /** Keywords for AI retrieval ranking */
  retrievalHints: { keywords: string[] };

  /**
   * Optional custom validation beyond what params express.
   * Return null if valid, or an error message string if invalid.
   * Called after standard required/when checks.
   */
  validate?: (state: Record<string, unknown>) => string | null;
}
