/**
 * R Code Generation Module
 *
 * Composable primitives for building R code structures with support for
 * functions, operators, assignments, and before/after code execution.
 *
 * @example
 * import { rFn, rOp, rSyntax, rAssign, toScript } from '@core/r-codegen';
 *
 * const code = rSyntax()
 *   .addBefore(rFn('library', { package: 'dplyr' }))
 *   .setBase(rFn('summarise', { n: 'n()' }))
 *   .setAssignment(rAssign('column', 'count', { dataframe: 'df' }));
 *
 * const script = code.toScript();
 */

// Types
export * from './types';

// Core implementation
export { toScript, formatParameter, sortParameters } from './core';

// Assignment generation
export { generateAssignment } from './assignment';

// RSyntax class
export { RSyntax } from './syntax';

// Builder functions
export {
  rFn,
  rFnStr,
  rOp,
  rSyntax,
  rAssign,
  rParam,
  rStr,
  rBool,
  rNull,
  rNA,
  rVec,
  rDf,
  rCol,
  // Expression chain helpers
  rPipe,
  rPlus,
  rAnd,
  rOr,
  rIf,
  rParams,
  rWrap,
  rComma,
  type MaybeExpr,
} from './builders';

// ggplot2 helpers
export {
  ggAes,
  ggBase,
  ggFacet,
  ggFlip,
  ggTheme,
  ggLabs,
} from './ggplot-helpers';
