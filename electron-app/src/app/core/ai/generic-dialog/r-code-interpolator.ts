/**
 * R Code Interpolator — Simple {{param}} substitution in R code strings.
 *
 * Emits BARE values. The rCode author controls R quoting/syntax.
 * The one exception: array kinds emit quoted, comma-separated elements
 * for use inside c().
 *
 * Examples:
 *   rCode: '{{dataframe}}${{col}}'       → 'df1$age'
 *   rCode: 'method = "{{method}}"'       → 'method = "pearson"'
 *   rCode: 'na.rm = {{naRm}}'            → 'na.rm = TRUE'
 *   rCode: 'c({{cols}})'                 → 'c("a", "b")'
 */

import type { DialogParamSchema, ParamKind } from '../dialog-schema.registry';

const PLACEHOLDER_RE = /\{\{(\w+)\}\}/g;

function formatForR(value: unknown, kind: ParamKind): string {
  if (value === undefined || value === null) return '';

  switch (kind) {
    case 'boolean':
      return value ? 'TRUE' : 'FALSE';

    case 'column[]':
    case 'string[]': {
      const arr = Array.isArray(value) ? value : [value];
      return arr.map(v => `"${String(v)}"`).join(', ');
    }

    default:
      return String(value);
  }
}

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
