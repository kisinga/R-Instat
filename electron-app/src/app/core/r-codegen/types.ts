/**
 * Core Type Definitions for R Code Generation
 *
 * Type system for building composable R code structures.
 */

/**
 * R parameter value - can be nested RCode, literal, or primitive
 */
export type RCodeValue = RCode | string | number | boolean;

/**
 * R parameter definition
 */
export interface Parameter {
  name: string;
  value: RCodeValue;
  position?: number; // -1 means undefined position, used for ordering
  includeName?: boolean; // Whether to include name in output (default: true for functions, false for operators)
}

/**
 * Operator formatting options
 */
export interface OperatorOptions {
  brackets?: boolean; // Enclose first parameter in brackets
  allBrackets?: boolean; // Enclose all parameters (except first) in brackets
  spaceAround?: boolean; // Put spaces around operator (default: true)
  forceInclude?: boolean; // Include operator even with single parameter (e.g., !x)
}

/**
 * R function structure
 */
export interface RFunction {
  type: 'function';
  name: string;
  package?: string;
  params: Parameter[];
}

/**
 * R operator structure
 */
export interface ROperator {
  type: 'operator';
  symbol: string;
  params: Parameter[];
  options?: OperatorOptions;
}

/**
 * R code - can be function, operator, or raw string
 */
export type RCode = RFunction | ROperator | string;

/**
 * Comparison operators for R expressions
 * These are the standard comparison operators used in R code generation.
 */
export type ComparisonOperator = '>=' | '>' | '<=' | '<';

/**
 * Assignment target types
 */
export type AssignTarget = 'variable' | 'column' | 'dataframe' | 'model' | 'graph' | 'table';

/**
 * Column assignment options
 */
export interface ColumnAssignOptions {
  dataframe?: string; // Dataframe to add column to
  before?: boolean; // Insert before (default: false)
  adjacentColumn?: string; // Column to insert adjacent to
  usePrefix?: boolean; // Use column name as prefix
  withoutNames?: boolean; // Don't assign to named column
  requireCorrectLength?: boolean; // Require correct length (default: true)
}

/**
 * Dataframe assignment options
 */
export interface DataframeAssignOptions {
  isList?: boolean; // Multiple dataframes
  dataFrameNames?: string; // R character vector for dataframe names if list not named
}

/**
 * Output object assignment options (model, graph, table)
 */
export interface ObjectAssignOptions {
  dataframe?: string; // Associated dataframe
  format?: string; // Object format
}

/**
 * Union of all assignment options
 */
export type AssignOptions = ColumnAssignOptions | DataframeAssignOptions | ObjectAssignOptions;

/**
 * Assignment configuration
 */
export interface Assignment {
  target: AssignTarget;
  name: string;
  options?: AssignOptions;
}
