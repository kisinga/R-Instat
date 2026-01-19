/**
 * R Code Generation Module
 *
 * Composable pure functions for building R code strings.
 *
 * @example
 * import { rDf, rFn, rPipe, rStr, rIf } from '@core/r-codegen';
 *
 * const code = rPipe(
 *   rDf('mydata'),
 *   rFn('filter', { x: '> 0' }),
 *   rFn('summarise', { mean_x: 'mean(x, na.rm = TRUE)' })
 * );
 */

export * from './primitives';
export * from './compose';
