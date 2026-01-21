/**
 * Core R Code Generation Implementation
 *
 * Converts RCode structures to R script strings.
 */

import { RCode, RFunction, ROperator, Parameter } from './types';

/**
 * Sort parameters by position (-1 goes to end)
 */
export function sortParameters(params: Parameter[]): Parameter[] {
  return [...params].sort((a, b) => {
    const posA = a.position ?? -1;
    const posB = b.position ?? -1;
    
    // -1 goes to end
    if (posA === -1 && posB !== -1) return 1;
    if (posB === -1 && posA !== -1) return -1;
    if (posA === -1 && posB === -1) return 0;
    
    return posA - posB;
  });
}

/**
 * Format a single parameter to R code string
 */
export function formatParameter(param: Parameter, script: string = ''): string {
  let result = '';
  
  // Include parameter name if needed
  if (param.includeName !== false && param.name) {
    result += `${param.name} = `;
  }
  
  // Format parameter value
  if (typeof param.value === 'string') {
    result += param.value;
  } else if (typeof param.value === 'number' || typeof param.value === 'boolean') {
    result += String(param.value);
  } else {
    // It's an RCode (function, operator, or string)
    result += toScript(param.value, script);
  }
  
  return result;
}

/**
 * Convert RCode to R script string
 *
 * @param code - R code structure (function, operator, or string)
 * @param script - Accumulated script for recursive calls (used for assignment handling)
 * @returns R code string
 */
export function toScript(code: RCode, script: string = ''): string {
  if (typeof code === 'string') {
    return code;
  }
  
  if (code.type === 'function') {
    return toScriptFunction(code, script);
  }
  
  if (code.type === 'operator') {
    return toScriptOperator(code, script);
  }
  
  return '';
}

/**
 * Convert RFunction to R script string
 */
function toScriptFunction(fn: RFunction, script: string): string {
  let result = '';
  
  // Package prefix
  if (fn.package) {
    result += `${fn.package}::`;
  }
  
  // Function name
  result += fn.name;
  
  // Parameters
  const sortedParams = sortParameters(fn.params);
  if (sortedParams.length > 0) {
    result += '(';
    result += sortedParams.map(p => formatParameter(p, script)).join(', ');
    result += ')';
  } else {
    result += '()';
  }
  
  return result;
}

/**
 * Convert ROperator to R script string
 */
function toScriptOperator(op: ROperator, script: string): string {
  const options = op.options || {};
  const spaceAround = options.spaceAround !== false; // Default true
  const brackets = options.brackets !== false; // Default true
  const allBrackets = options.allBrackets || false;
  const forceInclude = options.forceInclude || false;
  
  const sortedParams = sortParameters(op.params);
  
  if (sortedParams.length === 0) {
    return '';
  }
  
  // Format operator symbol with optional spacing
  const operatorStr = spaceAround ? ` ${op.symbol} ` : op.symbol;
  
  // Handle single parameter
  if (sortedParams.length === 1) {
    const param = sortedParams[0];
    const paramScript = formatParameter(param, script);
    
    if (forceInclude) {
      // Position 0 means parameter on left, otherwise on right
      const position = param.position ?? -1;
      if (position === 0) {
        return `${paramScript}${operatorStr}`;
      } else {
        return `${operatorStr}${paramScript}`;
      }
    } else {
      // Without forceInclude, single parameter doesn't show operator
      return paramScript;
    }
  }
  
  // Multiple parameters - build chain
  let result = '';
  
  // First parameter
  const firstParam = sortedParams[0];
  let firstScript = formatParameter(firstParam, script);
  
  // Apply brackets to first parameter if needed (and it's an operator/function)
  if (brackets && firstParam.value && typeof firstParam.value !== 'string' && 
      typeof firstParam.value !== 'number' && typeof firstParam.value !== 'boolean') {
    firstScript = `(${firstScript})`;
  }
  
  result += firstScript;
  
  // Remaining parameters
  for (let i = 1; i < sortedParams.length; i++) {
    const param = sortedParams[i];
    result += operatorStr;
    
    let paramScript = formatParameter(param, script);
    
    // Apply brackets if needed (allBrackets and it's an operator/function)
    if (allBrackets && param.value && typeof param.value !== 'string' && 
        typeof param.value !== 'number' && typeof param.value !== 'boolean') {
      paramScript = `(${paramScript})`;
    }
    
    result += paramScript;
  }
  
  return result;
}
