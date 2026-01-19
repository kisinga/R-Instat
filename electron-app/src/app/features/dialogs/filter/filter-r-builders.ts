/**
 * Filter R Code Builders
 *
 * Pure functions for generating R code for data filtering operations.
 */

import { rStr, rDf, rPipe, rAnd, rOr, rFn } from '../../../core/r-codegen';

// ============================================================================
// Types
// ============================================================================

export interface FilterCondition {
  column: string;
  operator: FilterOperator;
  value: string;
}

export type FilterOperator =
  | '=='
  | '!='
  | '>'
  | '>='
  | '<'
  | '<='
  | '%in%'
  | 'is.na'
  | '!is.na';

export type CombineLogic = '&' | '|';

export interface FilterOptions {
  dataframe: string;
  conditions: FilterCondition[];
  combineLogic: CombineLogic;
  outputName?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Build a single filter condition expression
 */
function buildConditionExpr(condition: FilterCondition): string | undefined {
  const { column, operator, value } = condition;

  if (!column) return undefined;

  // NA checks don't need a value
  if (operator === 'is.na') {
    return `is.na(${column})`;
  }
  if (operator === '!is.na') {
    return `!is.na(${column})`;
  }

  // Other operators need a value
  if (!value) return undefined;

  // Determine if value is numeric
  const isNumeric = !isNaN(Number(value)) && value.trim() !== '';
  const valueStr = isNumeric ? value : rStr(value);

  if (operator === '%in%') {
    // For %in%, value could be comma-separated
    const values = value.split(',').map((v) => {
      const trimmed = v.trim();
      const isNum = !isNaN(Number(trimmed)) && trimmed !== '';
      return isNum ? trimmed : rStr(trimmed);
    });
    return `${column} %in% c(${values.join(', ')})`;
  }

  return `${column} ${operator} ${valueStr}`;
}

/**
 * Check if a condition is valid (has required fields)
 */
export function isConditionValid(condition: FilterCondition): boolean {
  if (!condition.column) return false;
  if (condition.operator === 'is.na' || condition.operator === '!is.na') return true;
  return !!condition.value;
}

// ============================================================================
// Main Builder
// ============================================================================

/**
 * Build R code for filtering a dataframe
 *
 * @example
 * buildFilter({
 *   dataframe: 'mydata',
 *   conditions: [
 *     { column: 'age', operator: '>=', value: '18' },
 *     { column: 'status', operator: '==', value: 'active' }
 *   ],
 *   combineLogic: '&'
 * })
 * // Returns:
 * // filtered_data <- get_dataframe("mydata") %>%
 * //   dplyr::filter((age >= 18) & (status == "active"))
 * //
 * // add_dataframe("mydata_filtered", filtered_data)
 */
export function buildFilter(opts: FilterOptions): string {
  const { dataframe, conditions, combineLogic, outputName } = opts;

  if (!dataframe) {
    return '# Select a dataframe first';
  }

  // Build condition expressions, filtering invalid ones
  const conditionExprs = conditions
    .filter(isConditionValid)
    .map(buildConditionExpr)
    .filter((expr): expr is string => !!expr);

  if (conditionExprs.length === 0) {
    return '# Add filter conditions above';
  }

  // Combine conditions with logic operator
  const filterExpr =
    combineLogic === '&' ? rAnd(...conditionExprs) : rOr(...conditionExprs);

  const resultName = outputName || `${dataframe}_filtered`;

  // Build the full pipeline
  const pipeline = rPipe(rDf(dataframe), rFn('dplyr::filter', { condition: filterExpr }));

  // The filter function call needs special handling since the condition is not a named param
  const filterPipeline = `${rDf(dataframe)} %>%\n  dplyr::filter(${filterExpr})`;

  return `filtered_data <- ${filterPipeline}

add_dataframe(${rStr(resultName)}, filtered_data)`;
}

/**
 * Build just the filter expression (without assignment)
 * Useful for previewing or composing with other operations
 */
export function buildFilterExpression(opts: Omit<FilterOptions, 'outputName'>): string {
  const { dataframe, conditions, combineLogic } = opts;

  if (!dataframe) {
    return '# Select a dataframe first';
  }

  const conditionExprs = conditions
    .filter(isConditionValid)
    .map(buildConditionExpr)
    .filter((expr): expr is string => !!expr);

  if (conditionExprs.length === 0) {
    return '# Add filter conditions';
  }

  const filterExpr =
    combineLogic === '&' ? rAnd(...conditionExprs) : rOr(...conditionExprs);

  return `${rDf(dataframe)} %>%\n  dplyr::filter(${filterExpr})`;
}
