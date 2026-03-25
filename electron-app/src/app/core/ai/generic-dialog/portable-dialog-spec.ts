/**
 * Portable Dialog Spec — Fully JSON-serializable dialog definition.
 *
 * File format for .rinstat-dialog.json files.
 * Converted to a DialogContract via portableSpecToContract() before registration.
 *
 * Built-in specs keep their TypeScript build()/validate() functions.
 * This format is for user-imported/shared dialogs only.
 */

import type { DialogFamily } from '../dialog-catalog';
import type { DialogParamSchema } from '../dialog-schema.registry';

// ── Validation Rules ───────────────────────────────────────────────────

export type ValidationRule =
  | { rule: 'minItems'; param: string; min: number; message?: string }
  | { rule: 'maxItems'; param: string; max: number; message?: string }
  | { rule: 'range'; param: string; min?: number; max?: number; message?: string }
  | {
      rule: 'requiredWhen';
      param: string;
      when: { param: string; equals: unknown };
      message?: string;
    };

// ── Portable Dialog Spec ───────────────────────────────────────────────

export interface PortableDialogSpec {
  /** Format version for forward compatibility */
  formatVersion: '1.0';

  /** Unique dialog identifier (lowercase, hyphens, e.g. "my-custom-test") */
  dialogId: string;

  /** Human-readable title */
  title: string;

  /** Dialog family for categorization and AI retrieval */
  family: DialogFamily;

  /** Natural language description of what this dialog does */
  description: string;

  /** Operation taxonomy identifiers (e.g. "test.independence.factor_factor") */
  operations: string[];

  /** Parameter definitions — drives form rendering and AI grounding */
  params: DialogParamSchema[];

  /** Keywords for AI retrieval scoring */
  retrievalHints: { keywords: string[] };

  /** Declarative validation rules (optional) */
  validations?: ValidationRule[];

  /**
   * Raw R code with {{paramName}} placeholders.
   *
   * Placeholders are substituted based on param kind:
   *   string/column/enum  → "value" (R-quoted)
   *   number              → 30 (bare)
   *   boolean             → TRUE / FALSE
   *   column[]/string[]   → c("a", "b")
   *   dataframe           → bare name
   *
   * Example: "chisq.test(table({{dataframe}}${{col1}}, {{dataframe}}${{col2}}))"
   */
  rCode: string;

  /** Optional pre-filled values for sharing configured dialogs */
  defaultState?: Record<string, unknown>;

  /** Optional metadata about authorship and origin */
  meta?: {
    author?: string;
    version?: string;
    createdAt?: string;
    source?: string;
  };
}
