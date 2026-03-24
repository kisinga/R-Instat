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
}

export interface DialogSchema {
  dialogId: string;
  description: string;
  operations: string[];
  params: DialogParamSchema[];
}

/** Helper to build param definitions for dialog catalog descriptors. */
export function p(
  name: string,
  kind: ParamKind,
  opts: Omit<DialogParamSchema, 'name' | 'kind'> = {}
): DialogParamSchema {
  return { name, kind, ...opts };
}

