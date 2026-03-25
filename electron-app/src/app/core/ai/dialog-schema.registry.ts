/**
 * Dialog Schema Registry
 *
 * Strict schema used by:
 * - AI prompt/tool grounding
 * - Validation of model-produced state
 */

export type ParamKind =
  | 'dataframe'
  | 'column'
  | 'column[]'
  | 'string[]'
  | 'enum'
  | 'boolean'
  | 'number'
  | 'string'
  | 'object[]';

export type ColumnTypeHint = 'numeric' | 'factor' | 'date' | 'any';

export interface ParamCondition {
  param: string;
  equals: string | number | boolean;
}

export interface DialogParamSchema {
  name: string;
  kind: ParamKind;
  required?: boolean;
  columnType?: ColumnTypeHint;
  enumValues?: string[];
  min?: number;
  max?: number;
  when?: ParamCondition;

  /** Default value. Used by generic renderer for initial state and by AI for omitted fields. */
  default?: string | number | boolean;

  /** Display label override. Without this, the generic renderer derives a label from `name`. */
  label?: string;

  /**
   * Visual grouping key. Params with the same group render together under a shared heading.
   * The generic renderer uses this to create collapsible sections.
   */
  group?: string;
}

/** DialogSchema is now a derived type alias. Defined in dialog-catalog.ts, re-exported here for import compatibility. */
export type { DialogSchema } from './dialog-catalog';

/** Helper to build param definitions for dialog catalog descriptors. */
export function p(
  name: string,
  kind: ParamKind,
  opts: Omit<DialogParamSchema, 'name' | 'kind'> = {}
): DialogParamSchema {
  return { name, kind, ...opts };
}

