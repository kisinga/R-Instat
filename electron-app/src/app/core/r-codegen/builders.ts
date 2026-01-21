/**
 * Builder Functions for R Code Generation
 *
 * Composable helper functions for creating R code structures.
 */

import {
  RCode,
  RCodeValue,
  RFunction,
  ROperator,
  ROperatorSymbol,
  Parameter,
  Assignment,
  OperatorOptions,
  AssignOptions,
} from './types';
import { RSyntax } from './syntax';
import { toScript } from './core';

/**
 * Create an R function
 *
 * @param name - Function name (can include package prefix like 'dplyr::filter' or 'data_book$add')
 * @param params - Optional parameters as record
 * @param pkg - Optional package name (used only if name doesn't contain :: or $)
 * @returns RFunction structure
 */
export function rFn(
  name: string,
  params?: Record<string, any>,
  pkg?: string
): RFunction {
  // Handle package-qualified names (package::function or package$function)
  let actualName = name;
  let actualPkg = pkg;
  
  if (name.includes('::')) {
    const parts = name.split('::');
    actualPkg = parts[0];
    actualName = parts.slice(1).join('::'); // Handle nested :: (rare but possible)
  } else if (name.includes('$')) {
    // For $, treat everything before $ as package
    const parts = name.split('$');
    actualPkg = parts[0];
    actualName = parts.slice(1).join('$'); // Handle nested $ (e.g., obj$method$submethod)
  }
  
  const parameterList: Parameter[] = [];
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        parameterList.push({
          name: key,
          value: convertValue(value),
          includeName: true,
        });
      }
    }
  }
  
  return {
    type: 'function',
    name: actualName,
    package: actualPkg,
    params: parameterList,
  };
}

/**
 * Create an R function and return as string (for use with chain helpers)
 * This is a convenience wrapper for rFn + toScript
 */
export function rFnStr(
  name: string,
  params?: Record<string, any>,
  pkg?: string
): string {
  return toScript(rFn(name, params, pkg));
}

/**
 * Create an R operator
 *
 * @param symbol - Operator symbol (e.g., '+', '-', '!', '<-', '%>%')
 * @param params - Parameters (spread arguments)
 * @param options - Optional operator formatting options (can be passed as last argument)
 * @returns ROperator structure
 *
 * @example
 * rOp('>=', 'rain', 1)
 * rOp('>=', 'rain', 1, { asRString: true })
 * rOp('%>%', rDf('data'), rFn('filter', { x: '> 0' }))
 */
export function rOp(
  symbol: ROperatorSymbol,
  ...args: Array<RCode | string | number | boolean | OperatorOptions>
): ROperator {
  let paramsArray: Array<RCode | string | number | boolean>;
  let options: OperatorOptions | undefined;
  
  // Check if last argument is an options object
  if (args.length > 0) {
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && 
        ('brackets' in lastArg || 'allBrackets' in lastArg || 'spaceAround' in lastArg || 
         'forceInclude' in lastArg || 'asRString' in lastArg)) {
      // Last argument is options
      options = lastArg as OperatorOptions;
      paramsArray = args.slice(0, -1) as Array<RCode | string | number | boolean>;
    } else {
      // No options, all args are params
      paramsArray = args as Array<RCode | string | number | boolean>;
    }
  } else {
    paramsArray = [];
  }
  
  const parameterList: Parameter[] = paramsArray.map((param, index) => ({
    name: String(index),
    value: convertValue(param),
    position: index,
    includeName: false,
  }));
  
  return {
    type: 'operator',
    symbol,
    params: parameterList,
    options,
  };
}

/**
 * Create a new RSyntax instance
 */
export function rSyntax(): RSyntax {
  return new RSyntax();
}

/**
 * Create an assignment configuration
 *
 * @param target - Assignment target type
 * @param name - Name for the assignment
 * @param options - Optional assignment options
 * @returns Assignment configuration
 */
export function rAssign(
  target: Assignment['target'],
  name: string,
  options?: AssignOptions
): Assignment {
  return {
    target,
    name,
    options,
  };
}

/**
 * Create a parameter
 *
 * @param name - Parameter name
 * @param value - Parameter value
 * @param position - Optional position for ordering
 * @returns Parameter structure
 */
export function rParam(
  name: string,
  value: any,
  position?: number
): Parameter {
  return {
    name,
    value: convertValue(value),
    position,
    includeName: true,
  };
}

/**
 * Convert a value to RCodeValue
 */
function convertValue(value: any): RCodeValue {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  
  // Assume it's already an RCode structure
  return value as RCode;
}

/**
 * Helper: Create R string literal
 */
export function rStr(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Helper: Create R boolean literal
 */
export function rBool(b: boolean): string {
  return b ? 'TRUE' : 'FALSE';
}

/**
 * Helper: Create R NULL literal
 */
export function rNull(): string {
  return 'NULL';
}

/**
 * Helper: Create R NA literal
 */
export function rNA(): string {
  return 'NA';
}

/**
 * Helper: Create R vector
 */
export function rVec(items: string[], quote: boolean = true): string {
  if (items.length === 0) return 'c()';
  const formatted = items.map((i) => (quote ? rStr(i) : i));
  return items.length === 1 ? formatted[0] : `c(${formatted.join(', ')})`;
}

/**
 * Helper: Dataframe accessor
 */
export function rDf(name: string): string {
  return `get_dataframe(${rStr(name)})`;
}

/**
 * Helper: Column accessor
 */
export function rCol(df: string, col: string): string {
  return `${rDf(df)}$${col}`;
}

// ============================================================================
// Expression Chain Helpers (for backward compatibility)
// ============================================================================

/**
 * Falsy expression type for filtering
 */
export type MaybeExpr = string | undefined | false | null;

/**
 * Join expressions with %>% pipe operator
 *
 * Filters out falsy values (undefined, false, null, empty string).
 * Automatically converts RFunction/ROperator structures to strings.
 */
export function rPipe(...exprs: Array<MaybeExpr | RFunction | ROperator>): string {
  return exprs
    .filter(Boolean)
    .map((expr) => {
      if (typeof expr === 'string') return expr;
      if (expr && typeof expr === 'object' && 'type' in expr) {
        return toScript(expr as RCode);
      }
      return String(expr);
    })
    .join(' %>%\n  ');
}

/**
 * Join expressions with + (for ggplot layers)
 *
 * Filters out falsy values.
 * Automatically converts RFunction/ROperator structures to strings.
 */
export function rPlus(...exprs: Array<MaybeExpr | RFunction | ROperator>): string {
  return exprs
    .filter(Boolean)
    .map((expr) => {
      if (typeof expr === 'string') return expr;
      if (expr && typeof expr === 'object' && 'type' in expr) {
        return toScript(expr as RCode);
      }
      return String(expr);
    })
    .join(' +\n  ');
}

/**
 * Join expressions with & (logical AND)
 *
 * Wraps each expression in parentheses for safety.
 * Single expression is returned as-is.
 */
export function rAnd(...exprs: MaybeExpr[]): string {
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
 */
export function rOr(...exprs: MaybeExpr[]): string {
  const filtered = exprs.filter(Boolean) as string[];
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  return filtered.map((e) => `(${e})`).join(' | ');
}

/**
 * Conditional expression - returns undefined if condition is false
 *
 * Useful for optional pipeline steps that get filtered by rPipe/rPlus.
 * Accepts strings or RFunction/ROperator structures.
 */
export function rIf<T extends string | RFunction | ROperator>(
  condition: boolean,
  expr: T
): T | undefined {
  return condition ? expr : undefined;
}

/**
 * Named R parameters: key = value, key2 = value2
 *
 * Filters undefined values, handles type conversion.
 */
export function rParams(obj: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k} = ${rBool(v)}`;
      if (typeof v === 'number') return `${k} = ${v}`;
      return `${k} = ${v}`;
    })
    .join(', ');
}

/**
 * Wrap expression in parentheses
 */
export function rWrap(expr: string, condition: boolean = true): string {
  return condition ? `(${expr})` : expr;
}

/**
 * Join items with comma separator
 *
 * Useful for building comma-separated parameter lists.
 * Filters out falsy values and converts RCode structures to strings.
 *
 * @param items - Items to join (strings, numbers, booleans, or RCode structures)
 * @returns Comma-separated string
 */
export function rComma(...items: Array<string | number | boolean | RCode | undefined | null | false>): string {
  return items
    .filter((item): item is string | number | boolean | RCode => Boolean(item))
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      // It's an RCode structure
      return toScript(item);
    })
    .join(', ');
}
