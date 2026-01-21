/**
 * Assignment Generation
 *
 * Handles generating R code for different assignment targets (variable, column, dataframe, etc.)
 */

import { Assignment, ColumnAssignOptions, DataframeAssignOptions, ObjectAssignOptions, RFunction } from './types';
import { toScript } from './core';

/**
 * Escape R string with double quotes
 */
function rStr(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Convert boolean to R boolean literal
 */
function rBool(b: boolean): string {
  return b ? 'TRUE' : 'FALSE';
}

/**
 * Generate assignment code for an expression
 *
 * @param expr - The R expression to assign
 * @param assignment - Assignment configuration
 * @param script - Accumulated script (will be modified with multi-line assignments)
 * @returns The assignment target expression (e.g., variable name or data_book$get... call)
 */
export function generateAssignment(
  expr: string,
  assignment: Assignment,
  script: string = ''
): string {
  const { target, name, options } = assignment;
  
  switch (target) {
    case 'variable':
      return generateVariableAssignment(expr, name, script);
    
    case 'column':
      return generateColumnAssignment(expr, name, options as ColumnAssignOptions, script);
    
    case 'dataframe':
      return generateDataframeAssignment(expr, name, options as DataframeAssignOptions, script);
    
    case 'model':
    case 'graph':
    case 'table':
      return generateObjectAssignment(expr, name, target, options as ObjectAssignOptions, script);
    
    default:
      return expr;
  }
}

/**
 * Generate simple variable assignment: name <- expr
 */
function generateVariableAssignment(expr: string, name: string, script: string): string {
  // For multi-line expressions, assign to last line
  const lines = expr.split('\n');
  if (lines.length > 1) {
    const lastLine = lines[lines.length - 1];
    const beforeLines = lines.slice(0, -1);
    return `${beforeLines.join('\n')}\n${name} <- ${lastLine}`;
  }
  
  return `${name} <- ${expr}`;
}

/**
 * Generate column assignment with data_book$add_columns_to_data
 */
function generateColumnAssignment(
  expr: string,
  colName: string,
  options: ColumnAssignOptions,
  script: string
): string {
  const tempVar = `temp_${colName}`;
  
  // First: assign expression to temp variable
  const assignLine = generateVariableAssignment(expr, tempVar, script);
  
  // Build add_columns_to_data call
  const params: Record<string, any> = {
    data_name: rStr(options.dataframe || ''),
    col_data: tempVar,
  };
  
  if (!options.withoutNames) {
    params['col_name'] = rStr(colName);
  }
  
  if (options.usePrefix) {
    params['use_col_name_as_prefix'] = 'TRUE';
  }
  
  if (options.before !== undefined) {
    params['before'] = rBool(options.before);
  }
  
  if (options.adjacentColumn) {
    params['adjacent_column'] = options.adjacentColumn;
  }
  
  if (options.requireCorrectLength === false) {
    params['require_correct_length'] = 'FALSE';
  }
  
  const addCall = toScript({
    type: 'function',
    name: 'data_book$add_columns_to_data',
    params: Object.entries(params).map(([name, value]) => ({
      name,
      value: typeof value === 'string' ? value : String(value),
      includeName: true,
    })),
  });
  
  // Return multi-line: assignment + add call
  return `${assignLine}\n${addCall}`;
}

/**
 * Generate dataframe assignment with data_book$import_data
 */
function generateDataframeAssignment(
  expr: string,
  dfName: string,
  options: DataframeAssignOptions,
  script: string
): string {
  const tempVar = `temp_${dfName}`;
  
  // First: assign expression to temp variable
  const assignLine = generateVariableAssignment(expr, tempVar, script);
  
  // Build import_data call
  const params: Record<string, any> = {};
  
  if (options.isList) {
    // Multiple dataframes
    params['data_tables'] = tempVar;
    if (options.dataFrameNames) {
      params['data_names'] = options.dataFrameNames;
    }
  } else {
    // Single dataframe - wrap in list
    params['data_tables'] = `list(${dfName} = ${tempVar})`;
  }
  
  const importCall = toScript({
    type: 'function',
    name: 'data_book$import_data',
    params: Object.entries(params).map(([name, value]) => ({
      name,
      value: typeof value === 'string' ? value : String(value),
      includeName: true,
    })),
  });
  
  // Return multi-line: assignment + import call
  return `${assignLine}\n${importCall}`;
}

/**
 * Generate object assignment (model, graph, table) with data_book$add_object
 */
function generateObjectAssignment(
  expr: string,
  objectName: string,
  objectType: 'model' | 'graph' | 'table',
  options: ObjectAssignOptions,
  script: string
): string {
  const tempVar = `temp_${objectName}`;
  
  // First: assign expression to temp variable
  const assignLine = generateVariableAssignment(expr, tempVar, script);
  
  // Build add_object call
  const params: Record<string, any> = {
    object_name: rStr(objectName),
    object_type_label: rStr(objectType),
    object_format: rStr(options.format || 'text'),
  };
  
  if (options.dataframe) {
    params['data_name'] = rStr(options.dataframe);
  }
  
  // For graphs, wrap in check_graph
  if (objectType === 'graph') {
    params['object'] = `instatExtras::check_graph(${tempVar})`;
  } else {
    params['object'] = tempVar;
  }
  
  const addCall = toScript({
    type: 'function',
    name: 'data_book$add_object',
    params: Object.entries(params).map(([name, value]) => ({
      name,
      value: typeof value === 'string' ? value : String(value),
      includeName: true,
    })),
  });
  
  // Return multi-line: assignment + add call
  return `${assignLine}\n${addCall}`;
}
