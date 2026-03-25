/**
 * Portable Spec Validator — Validates raw JSON before accepting an import.
 */

import type { PortableDialogSpec } from './portable-dialog-spec';
import type { ParamKind } from '../dialog-schema.registry';
import { isKnownDialogId } from '../dialog-identity.registry';

export interface PortableSpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const VALID_KINDS: Set<string> = new Set<ParamKind>([
  'dataframe', 'column', 'column[]', 'string[]', 'enum',
  'boolean', 'number', 'string', 'object[]', 'checklist',
]);

const DIALOG_ID_RE = /^[a-z][a-z0-9-]*$/;

const MAX_SIZE = 100 * 1024; // 100KB

export function validatePortableSpec(
  raw: unknown,
  jsonSize?: number
): PortableSpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (jsonSize !== undefined && jsonSize > MAX_SIZE) {
    errors.push(`Spec exceeds maximum size (${MAX_SIZE} bytes)`);
    return { valid: false, errors, warnings };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    errors.push('Spec must be a JSON object');
    return { valid: false, errors, warnings };
  }

  const spec = raw as Record<string, unknown>;

  // formatVersion
  if (spec['formatVersion'] !== '1.0') {
    errors.push(`Unsupported formatVersion: ${spec['formatVersion']} (expected "1.0")`);
  }

  // dialogId
  const dialogId = spec['dialogId'];
  if (typeof dialogId !== 'string' || !DIALOG_ID_RE.test(dialogId)) {
    errors.push('dialogId must be lowercase letters, numbers, and hyphens (e.g. "my-dialog")');
  } else if (isKnownDialogId(dialogId)) {
    errors.push(`dialogId "${dialogId}" conflicts with an existing dialog`);
  }

  // Required strings
  for (const field of ['title', 'description', 'rCode'] as const) {
    if (typeof spec[field] !== 'string' || !(spec[field] as string).trim()) {
      errors.push(`${field} is required and must be a non-empty string`);
    }
  }

  // family
  const validFamilies = ['plotting', 'data-preparation', 'inferential', 'predictive', 'climatic', 'other'];
  if (!validFamilies.includes(spec['family'] as string)) {
    errors.push(`family must be one of: ${validFamilies.join(', ')}`);
  }

  // operations
  if (!Array.isArray(spec['operations']) || (spec['operations'] as unknown[]).length === 0) {
    errors.push('operations must be a non-empty array');
  }

  // params
  const params = spec['params'];
  if (!Array.isArray(params)) {
    errors.push('params must be an array');
  } else {
    for (let i = 0; i < (params as unknown[]).length; i++) {
      const param = (params as Record<string, unknown>[])[i];
      if (!param || typeof param['name'] !== 'string') {
        errors.push(`params[${i}].name is required`);
      }
      if (!param || !VALID_KINDS.has(param['kind'] as string)) {
        errors.push(`params[${i}].kind "${param?.['kind']}" is not valid`);
      }
    }
  }

  // retrievalHints
  const hints = spec['retrievalHints'] as Record<string, unknown> | undefined;
  if (!hints || !Array.isArray(hints['keywords'])) {
    warnings.push('retrievalHints.keywords should be an array (AI retrieval will be less effective)');
  }

  // validations (optional)
  if (spec['validations'] !== undefined) {
    if (!Array.isArray(spec['validations'])) {
      errors.push('validations must be an array if present');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Parse and validate a JSON string as a PortableDialogSpec.
 * Returns the parsed spec and validation result.
 */
export function parseAndValidatePortableSpec(
  jsonString: string
): { spec: PortableDialogSpec | null; result: PortableSpecValidationResult } {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (e) {
    return {
      spec: null,
      result: { valid: false, errors: [`Invalid JSON: ${(e as Error).message}`], warnings: [] },
    };
  }

  const result = validatePortableSpec(raw, jsonString.length);
  return {
    spec: result.valid ? (raw as PortableDialogSpec) : null,
    result,
  };
}
