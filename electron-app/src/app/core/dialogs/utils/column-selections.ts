/**
 * Column Selection Utilities
 *
 * Utilities for managing column selections as composable R code primitives.
 * These functions convert string column selections into proper R code references
 * that can be composed with other R code structures.
 */

import { RCode } from '../../r-codegen/types';
import { rCol, rDf } from '../../r-codegen';

/**
 * Create a column reference as R code
 *
 * Returns an R code expression for accessing a column: `get_dataframe("df")$col`
 *
 * @param df - Dataframe name
 * @param col - Column name
 * @returns R code string for column access
 */
export function columnRef(df: string, col: string): RCode {
  return rCol(df, col);
}

/**
 * Create multiple column references
 *
 * @param df - Dataframe name
 * @param cols - Array of column names
 * @returns Array of R code strings for column access
 */
export function columnsRef(df: string, cols: string[]): RCode[] {
  return cols.map((col) => columnRef(df, col));
}

/**
 * Create column reference vector for R
 *
 * Returns R code like: `c(col1, col2, col3)`
 * Useful for functions that take multiple columns.
 *
 * @param cols - Array of column names (will be quoted in R)
 * @returns R code string for column vector
 */
export function columnVector(cols: string[]): string {
  if (cols.length === 0) return 'c()';
  const quoted = cols.map((col) => `"${col}"`);
  return `c(${quoted.join(', ')})`;
}

/**
 * Validate that columns exist (basic check)
 *
 * This is a TypeScript-level validation. For runtime validation,
 * you would need to check against actual dataframe columns.
 *
 * @param cols - Column names to validate
 * @returns True if all columns are non-empty strings
 */
export function validateColumnNames(cols: string[]): boolean {
  return cols.every((col) => typeof col === 'string' && col.trim().length > 0);
}
