/**
 * R Code Generation Primitives
 *
 * Atomic R literal formatting functions. Single source of truth for
 * converting TypeScript values to R code strings.
 */

// ============================================================================
// Literals
// ============================================================================

/** R string literal with escaped quotes */
export const rStr = (s: string): string => `"${s.replace(/"/g, '\\"')}"`;

/** R boolean literal */
export const rBool = (b: boolean): string => (b ? 'TRUE' : 'FALSE');

/** R numeric literal */
export const rNum = (n: number): string => String(n);

/** R NULL literal */
export const rNull = (): string => 'NULL';

/** R NA literal */
export const rNA = (): string => 'NA';

// ============================================================================
// Vectors
// ============================================================================

/**
 * R vector: c("a", "b") or single value if length 1
 *
 * @param items - Array of items to convert
 * @param quote - Whether to quote items as strings (default: true)
 * @returns R vector expression
 *
 * @example
 * rVec(['a']) // => '"a"'
 * rVec(['a', 'b']) // => 'c("a", "b")'
 * rVec(['x', 'y'], false) // => 'c(x, y)'
 */
export function rVec(items: string[], quote = true): string {
  if (items.length === 0) return 'c()';
  const formatted = items.map((i) => (quote ? rStr(i) : i));
  return items.length === 1 ? formatted[0] : `c(${formatted.join(', ')})`;
}

// ============================================================================
// Data Access
// ============================================================================

/** Dataframe accessor via bridge function */
export const rDf = (name: string): string => `get_dataframe(${rStr(name)})`;

/** Column accessor: df$col */
export const rCol = (df: string, col: string): string => `${rDf(df)}$${col}`;

// ============================================================================
// Parameters
// ============================================================================

/** Type for R parameter values */
export type RParamValue = string | number | boolean | undefined;

/** Type for R parameter object */
export type RParamRecord = Record<string, RParamValue>;

/**
 * Named R parameters: key = value, key2 = value2
 *
 * Filters undefined values, handles type conversion.
 *
 * @param obj - Object with parameter names and values
 * @returns Formatted parameter string
 *
 * @example
 * rParams({ x: 1, y: 'col', z: true }) // => 'x = 1, y = col, z = TRUE'
 * rParams({ a: 1, b: undefined }) // => 'a = 1'
 */
export function rParams(obj: RParamRecord): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k} = ${rBool(v)}`;
      if (typeof v === 'number') return `${k} = ${v}`;
      return `${k} = ${v}`;
    })
    .join(', ');
}
