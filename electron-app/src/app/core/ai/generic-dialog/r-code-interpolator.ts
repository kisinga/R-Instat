/**
 * R Code Interpolator — Simple {{param}} substitution in R code strings.
 *
 * No conditionals, no control flow, no DSL.
 * The user writes real R code with holes punched for form values.
 * Formatting is derived from the param's `kind` in the schema.
 */

import type { DialogParamSchema, ParamKind } from '../dialog-schema.registry';

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

/**
 * Format a value for R code based on param kind.
 */
function formatForR(value: unknown, kind: ParamKind): string {
  if (value === undefined || value === null) return '';

  switch (kind) {
    case 'dataframe':
      return String(value);

    case 'number':
      return String(value);

    case 'boolean':
      return value ? 'TRUE' : 'FALSE';

    case 'column':
    case 'string':
    case 'enum':
      return `"${String(value)}"`;

    case 'column[]':
    case 'string[]': {
      const arr = Array.isArray(value) ? value : [value];
      return `c(${arr.map(v => `"${String(v)}"`).join(', ')})`;
    }

    default:
      return String(value);
  }
}

/**
 * Build a kind-lookup map from params array for O(1) access.
 */
function buildKindMap(params: DialogParamSchema[]): Map<string, ParamKind> {
  const map = new Map<string, ParamKind>();
  for (const p of params) {
    map.set(p.name, p.kind);
  }
  return map;
}

/**
 * Substitute {{paramName}} placeholders in R code with state values.
 * Returns null if the rCode is empty or the result is whitespace-only.
 */
export function interpolateRCode(
  rCode: string,
  state: Record<string, unknown>,
  params: DialogParamSchema[]
): string | null {
  if (!rCode) return null;

  const kindMap = buildKindMap(params);

  const result = rCode.replace(PLACEHOLDER_RE, (_, paramName: string) => {
    const value = state[paramName];
    const kind = kindMap.get(paramName) ?? 'string';
    return formatForR(value, kind);
  });

  const trimmed = result.trim();
  return trimmed || null;
}
