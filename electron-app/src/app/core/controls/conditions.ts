/**
 * Condition Types and Evaluation
 *
 * Conditions determine control state based on R code structure.
 */

import { RCode, RFunction, ROperator, Parameter } from '../r-codegen/types';
import { RSyntax } from '../r-codegen/syntax';

/**
 * Condition types for evaluating R code state
 */
export type Condition =
  | { type: 'parameterPresent'; paramNames: string[]; positive: boolean }
  | { type: 'parameterValue'; paramName: string; values: string[]; positive: boolean }
  | { type: 'functionName'; functionNames: string[]; positive: boolean }
  | {
      type: 'parameterType';
      paramName: string;
      paramType: 'string' | 'function' | 'operator';
      positive: boolean;
    }
  | {
      type: 'parameterValueFunction';
      paramName: string;
      functionNames: string[];
      positive: boolean;
    }
  | { type: 'syntaxContainsFunction'; functionNames: string[]; positive: boolean }
  | { type: 'syntaxContainsCode'; code: RCode; positive: boolean }
  | { type: 'isFunction'; positive: boolean };

/**
 * Get parameter from RCode if it's a function
 */
function getParameterFromCode(
  rCode: RCode | null,
  paramName: string
): Parameter | null {
  if (!rCode || typeof rCode === 'string') {
    return null;
  }

  if (rCode.type === 'function') {
    return rCode.params.find((p) => p.name === paramName) || null;
  }

  return null;
}

/**
 * Check if RCode is a function
 */
function isFunction(rCode: RCode | null): boolean {
  return rCode !== null && typeof rCode !== 'string' && rCode.type === 'function';
}

/**
 * Get function name from RCode
 */
function getFunctionName(rCode: RCode | null): string | null {
  if (isFunction(rCode)) {
    return (rCode as RFunction).name;
  }
  return null;
}

/**
 * Check if parameter has a specific value (string)
 */
function parameterHasValue(
  param: Parameter | null,
  values: string[]
): boolean {
  if (!param) return false;
  
  if (typeof param.value === 'string') {
    return values.includes(param.value);
  }
  
  return false;
}

/**
 * Check parameter type
 */
function checkParameterType(
  param: Parameter | null,
  expectedType: 'string' | 'function' | 'operator'
): boolean {
  if (!param) return false;
  
  if (expectedType === 'string') {
    return (
      typeof param.value === 'string' ||
      typeof param.value === 'number' ||
      typeof param.value === 'boolean'
    );
  }
  
  if (expectedType === 'function') {
    return (
      typeof param.value !== 'string' &&
      typeof param.value !== 'number' &&
      typeof param.value !== 'boolean' &&
      param.value !== null &&
      typeof param.value === 'object' &&
      'type' in param.value &&
      param.value.type === 'function'
    );
  }
  
  if (expectedType === 'operator') {
    return (
      typeof param.value !== 'string' &&
      typeof param.value !== 'number' &&
      typeof param.value !== 'boolean' &&
      param.value !== null &&
      typeof param.value === 'object' &&
      'type' in param.value &&
      param.value.type === 'operator'
    );
  }
  
  return false;
}

/**
 * Check if parameter value is a function with specific names
 */
function parameterValueIsFunction(
  param: Parameter | null,
  functionNames: string[]
): boolean {
  if (!param || typeof param.value === 'string' || 
      typeof param.value === 'number' || typeof param.value === 'boolean') {
    return false;
  }
  
  if (typeof param.value === 'object' && param.value !== null && 'type' in param.value) {
    if (param.value.type === 'function') {
      return functionNames.includes((param.value as RFunction).name);
    }
  }
  
  return false;
}

/**
 * Check if syntax contains specific function names
 */
function syntaxContainsFunction(
  syntax: RSyntax | null,
  functionNames: string[]
): boolean {
  if (!syntax) return false;
  
  const allCodes = [
    ...syntax.getAllAssignments(),
    syntax.base,
  ].filter((c): c is RCode => c !== undefined);
  
  for (const code of allCodes) {
    const name = getFunctionName(code);
    if (name && functionNames.includes(name)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if syntax contains specific code
 */
function syntaxContainsCode(
  syntax: RSyntax | null,
  code: RCode
): boolean {
  if (!syntax) return false;
  
  const allCodes = [
    ...syntax.getAllAssignments(),
    syntax.base,
  ].filter((c): c is RCode => c !== undefined);
  
  // Simple equality check (could be enhanced with deep equality)
  return allCodes.some((c) => c === code);
}

/**
 * Check if RCode contains parameter
 */
function codeContainsParameter(rCode: RCode | null, paramName: string): boolean {
  if (!isFunction(rCode)) {
    return false;
  }
  
  const fn = rCode as RFunction;
  return fn.params.some((p) => p.name === paramName);
}

/**
 * Evaluate a single condition
 */
export function evaluateCondition(
  condition: Condition,
  rCode: RCode | null,
  param: Parameter | null,
  syntax: RSyntax | null
): boolean {
  switch (condition.type) {
    case 'parameterPresent': {
      const present = condition.paramNames.some((name) =>
        codeContainsParameter(rCode, name)
      );
      return condition.positive === present;
    }

    case 'parameterValue': {
      const hasValue = parameterHasValue(
        param || getParameterFromCode(rCode, condition.paramName),
        condition.values
      );
      return condition.positive === hasValue;
    }

    case 'functionName': {
      const name = getFunctionName(rCode);
      const matches = name ? condition.functionNames.includes(name) : false;
      return condition.positive === matches;
    }

    case 'parameterType': {
      const paramToCheck =
        param || getParameterFromCode(rCode, condition.paramName);
      const matches = checkParameterType(paramToCheck, condition.paramType);
      return condition.positive === matches;
    }

    case 'parameterValueFunction': {
      const paramToCheck =
        param || getParameterFromCode(rCode, condition.paramName);
      const matches = parameterValueIsFunction(paramToCheck, condition.functionNames);
      return condition.positive === matches;
    }

    case 'syntaxContainsFunction': {
      const matches = syntaxContainsFunction(syntax, condition.functionNames);
      return condition.positive === matches;
    }

    case 'syntaxContainsCode': {
      const matches = syntaxContainsCode(syntax, condition.code);
      return condition.positive === matches;
    }

    case 'isFunction': {
      const matches = isFunction(rCode);
      return condition.positive === matches;
    }

    default:
      return false;
  }
}

/**
 * Evaluate multiple conditions (all must be true)
 */
export function evaluateConditions(
  conditions: Condition[],
  rCode: RCode | null,
  param: Parameter | null,
  syntax: RSyntax | null
): boolean {
  return conditions.every((cond) =>
    evaluateCondition(cond, rCode, param, syntax)
  );
}
