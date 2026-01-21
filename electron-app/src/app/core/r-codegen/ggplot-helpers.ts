/**
 * ggplot2 Helper Functions
 *
 * Shared utilities for building ggplot2 layers and aesthetics.
 * These functions are used across all graph dialog builders to ensure
 * consistency and reduce duplication.
 *
 * All helpers are pure functions that return strings or undefined
 * (undefined values are automatically filtered by rPlus/rPipe).
 */

import { rDf, rStr } from './builders';

/**
 * Build aes() string from mappings
 *
 * Filters out undefined values and formats as `aes(x = col, y = val, ...)`
 *
 * @param mappings - Aesthetic mappings (x, y, fill, color, etc.)
 * @returns Formatted aes() string
 */
export function ggAes(mappings: Record<string, string | undefined>): string {
  const parts = Object.entries(mappings)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${v}`);
  return `aes(${parts.join(', ')})`;
}

/**
 * Build ggplot base: ggplot(data, aes(...))
 *
 * @param df - Dataframe name
 * @param aes - Aesthetic string (use ggAes() to generate)
 * @returns ggplot base call
 */
export function ggBase(df: string, aes: string): string {
  return `ggplot(${rDf(df)}, ${aes})`;
}

/**
 * Build facet_wrap layer
 *
 * Returns undefined if no facet column is provided, allowing it to be
 * filtered out by rPlus().
 *
 * @param by - Column name to facet by (optional)
 * @returns facet_wrap() call or undefined
 */
export function ggFacet(by?: string): string | undefined {
  return by ? `facet_wrap(~ ${by})` : undefined;
}

/**
 * Build coord_flip layer
 *
 * Returns undefined if flip is false, allowing it to be filtered out by rPlus().
 *
 * @param flip - Whether to flip coordinates (optional)
 * @returns coord_flip() call or undefined
 */
export function ggFlip(flip?: boolean): string | undefined {
  return flip ? 'coord_flip()' : undefined;
}

/**
 * Build theme layer
 *
 * @param name - Theme name (default: 'minimal')
 * @returns theme_*() call
 */
export function ggTheme(name: string = 'minimal'): string {
  return `theme_${name}()`;
}

/**
 * Build labs() layer for titles and axis labels
 *
 * Filters out undefined values and formats labels as R strings.
 *
 * @param opts - Label options
 * @returns labs() call
 */
export function ggLabs(opts: {
  title?: string;
  x?: string;
  y?: string;
  fill?: string;
  color?: string;
  subtitle?: string;
}): string {
  const params = Object.entries(opts)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${rStr(v as string)}`);
  return params.length > 0 ? `labs(${params.join(', ')})` : '';
}
