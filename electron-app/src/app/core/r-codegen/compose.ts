/**
 * R Code Composition Functions
 *
 * Higher-order functions for building R function calls and chaining expressions.
 * These compose cleanly with the primitives to build complex R code.
 */

import { rParams, RParamRecord } from './primitives';

// ============================================================================
// Types
// ============================================================================

/** R expression (string) */
export type RExpr = string;

/** Falsy expression type for filtering */
export type MaybeExpr = RExpr | undefined | false | null;

// ============================================================================
// Function Calls
// ============================================================================

/**
 * Build R function call: name(params)
 *
 * @param name - Function name
 * @param params - Optional named parameters
 * @param pkg - Optional package prefix (e.g., 'dplyr')
 * @returns R function call string
 *
 * @example
 * rFn('summarise', { total: 'sum(x)', n: 'n()' })
 * // => 'summarise(total = sum(x), n = n())'
 *
 * rFn('summarise', { n: 'n()' }, 'dplyr')
 * // => 'dplyr::summarise(n = n())'
 */
export function rFn(name: string, params?: RParamRecord, pkg?: string): RExpr {
  const prefix = pkg ? `${pkg}::` : '';
  const args = params ? rParams(params) : '';
  return `${prefix}${name}(${args})`;
}

// ============================================================================
// Expression Chains
// ============================================================================

/**
 * Join expressions with %>% pipe operator
 *
 * Filters out falsy values (undefined, false, null, empty string).
 *
 * @param exprs - Expressions to chain
 * @returns Piped R expression with newlines
 *
 * @example
 * rPipe(rDf('data'), rFn('mutate', { x: '1' }), rFn('filter', { y: '2' }))
 * // => 'get_dataframe("data") %>%\n  mutate(x = 1) %>%\n  filter(y = 2)'
 */
export function rPipe(...exprs: MaybeExpr[]): RExpr {
  return exprs.filter(Boolean).join(' %>%\n  ');
}

/**
 * Join expressions with + (for ggplot layers)
 *
 * Filters out falsy values.
 *
 * @param exprs - ggplot layer expressions
 * @returns Combined ggplot expression
 *
 * @example
 * rPlus('ggplot(df, aes(x))', 'geom_point()', 'theme_minimal()')
 * // => 'ggplot(df, aes(x)) +\n  geom_point() +\n  theme_minimal()'
 */
export function rPlus(...exprs: MaybeExpr[]): RExpr {
  return exprs.filter(Boolean).join(' +\n  ');
}

/**
 * Join expressions with & (logical AND)
 *
 * Wraps each expression in parentheses for safety.
 * Single expression is returned as-is.
 *
 * @param exprs - Boolean expressions
 * @returns Combined AND expression
 *
 * @example
 * rAnd('x > 0', 'y < 10')
 * // => '(x > 0) & (y < 10)'
 */
export function rAnd(...exprs: MaybeExpr[]): RExpr {
  const filtered = exprs.filter(Boolean) as string[];
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  return filtered.map((e) => `(${e})`).join(' & ');
}

/**
 * Join expressions with | (logical OR)
 *
 * Wraps each expression in parentheses for safety.
 * Single expression is returned as-is.
 *
 * @param exprs - Boolean expressions
 * @returns Combined OR expression
 *
 * @example
 * rOr('x == 1', 'x == 2')
 * // => '(x == 1) | (x == 2)'
 */
export function rOr(...exprs: MaybeExpr[]): RExpr {
  const filtered = exprs.filter(Boolean) as string[];
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  return filtered.map((e) => `(${e})`).join(' | ');
}

// ============================================================================
// Conditional Helpers
// ============================================================================

/**
 * Conditional expression - returns undefined if condition is false
 *
 * Useful for optional pipeline steps that get filtered by rPipe/rPlus.
 *
 * @param condition - Boolean condition
 * @param expr - Expression to return if true
 * @returns Expression or undefined
 *
 * @example
 * rPipe(
 *   rDf('data'),
 *   rIf(hasFilter, rFn('filter', { x: '> 0' })),
 *   rFn('summarise', { n: 'n()' })
 * )
 * // If hasFilter is false, the filter step is omitted
 */
export function rIf<T extends RExpr>(condition: boolean, expr: T): T | undefined {
  return condition ? expr : undefined;
}

/**
 * Wrap expression in parentheses
 *
 * @param expr - Expression to wrap
 * @param condition - Whether to wrap (default: true)
 * @returns Wrapped or original expression
 */
export function rWrap(expr: RExpr, condition = true): RExpr {
  return condition ? `(${expr})` : expr;
}
