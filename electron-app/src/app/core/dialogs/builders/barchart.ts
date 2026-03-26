/**
 * Bar Chart Builders
 *
 * Composable framework for generating R code for different bar chart types.
 * Uses discriminated unions for type safety and shared helper functions for composition.
 *
 * Chart Types:
 * - Frequency: Counts occurrences (stat="count")
 * - Value: Uses actual numeric values (stat="identity")
 */

import { RSyntax, rSyntax, rFn, rStr, rPlus, rAssign } from '../../r-codegen';
import { ggBase, ggAes, ggFlip, ggTheme, ggLabs } from '../../r-codegen/ggplot-helpers';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Base options common to all bar chart types
 */
interface BaseBarChartOptions {
  /** Dataframe name */
  dataframe: string;
  /** Bar position: stack, dodge, or fill */
  position?: 'stack' | 'dodge' | 'fill';
  /** Whether to flip coordinates (horizontal bars) */
  horizontal?: boolean;
  /** Chart title */
  title?: string;
  /** Output graph name for assignment */
  name?: string;
  /** Optional fill variable (factor) for grouping */
  fillVariable?: string;
}

/**
 * Frequency Bar Chart Options
 *
 * Counts occurrences of categorical values.
 * Y-axis is automatically computed as count (stat="count").
 */
export interface FrequencyBarChartOptions extends BaseBarChartOptions {
  type: 'frequency';
  /** X-axis variable (factor/categorical) - required */
  xVariable: string;
}

/**
 * Value Bar Chart Options
 *
 * Uses actual numeric values from data.
 * Requires both x (factor) and y (numeric) variables.
 */
export interface ValueBarChartOptions extends BaseBarChartOptions {
  type: 'value';
  /** X-axis variable (factor/categorical) - required */
  xVariable: string;
  /** Y-axis variable (numeric) - required */
  yVariable: string;
}

/**
 * Discriminated union of all bar chart options
 *
 * TypeScript will narrow the type based on the `type` discriminator,
 * ensuring type-safe access to type-specific properties.
 */
export type BarChartOptions = FrequencyBarChartOptions | ValueBarChartOptions;

// ============================================================================
// Shared Helper Function
// ============================================================================

/**
 * Build common bar chart R code
 *
 * Extracts shared logic for both frequency and value bar charts.
 * This function handles the common parts: aesthetics, geom, layers, and assignment.
 *
 * @param options - Base bar chart options
 * @param xVariable - X-axis variable name
 * @param yVariable - Y-axis variable name (undefined for frequency charts)
 * @param stat - Geom stat: 'count' for frequency, 'identity' for value
 * @param yLabel - Y-axis label text
 * @returns RSyntax instance with ggplot2 code
 */
function buildBarChartCommon(
  options: BaseBarChartOptions,
  xVariable: string,
  yVariable: string | undefined,
  stat: 'count' | 'identity',
  yLabel: string
): RSyntax {
  // Build aesthetics mapping
  const aesMappings: Record<string, string | undefined> = {
    x: xVariable,
    y: yVariable,
    fill: options.fillVariable,
  };

  // Build ggplot code
  const baseCode = rPlus(
    ggBase(options.dataframe, ggAes(aesMappings)),
    rFn('geom_bar', {
      stat: rStr(stat),
      position: rStr(options.position || 'stack'),
      alpha: '0.8',
    }),
    options.horizontal ? ggFlip(true) : undefined,
    ggTheme(),
    ggLabs({
      title: options.title || (yVariable 
        ? `Bar Chart of ${yVariable} by ${xVariable}`
        : `Bar Chart of ${xVariable}`),
      x: xVariable,
      y: yLabel,
    })
  );

  let syntax = rSyntax().setBase(baseCode);

  // Set assignment if output name provided
  if (options.name) {
    syntax = syntax.setAssignment(
      rAssign('graph', options.name, {
        format: 'text',
      })
    );
  }

  return syntax;
}

// ============================================================================
// Type-Specific Builders
// ============================================================================

/**
 * Build R code for a frequency bar chart
 *
 * Frequency charts count occurrences of categorical values.
 * The y-axis is automatically computed as count (stat="count").
 *
 * @param options - Frequency bar chart configuration
 * @returns RSyntax instance with ggplot2 code
 */
function buildFrequencyBarChart(options: FrequencyBarChartOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.xVariable) {
    return rSyntax().setBase('# Select an X variable');
  }

  // Use shared helper with frequency-specific parameters
  return buildBarChartCommon(
    options,
    options.xVariable,
    undefined, // No y variable for frequency (count is computed)
    'count',
    'Count'
  );
}

/**
 * Build R code for a value bar chart
 *
 * Value charts use actual numeric values from the data.
 * Requires both x (factor) and y (numeric) variables.
 *
 * @param options - Value bar chart configuration
 * @returns RSyntax instance with ggplot2 code
 */
function buildValueBarChart(options: ValueBarChartOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.xVariable) {
    return rSyntax().setBase('# Select an X variable');
  }

  if (!options.yVariable) {
    return rSyntax().setBase('# Select a Y variable');
  }

  // Use shared helper with value-specific parameters
  return buildBarChartCommon(
    options,
    options.xVariable,
    options.yVariable,
    'identity',
    options.yVariable
  );
}

// ============================================================================
// Unified Dispatcher
// ============================================================================

/**
 * Build R code for a bar chart
 *
 * Dispatches to the appropriate builder based on chart type.
 * TypeScript narrows the options type based on the discriminator.
 *
 * @param options - Bar chart configuration (discriminated union)
 * @returns RSyntax instance with ggplot2 code
 */
export function buildBarChart(options: BarChartOptions): RSyntax {
  switch (options.type) {
    case 'frequency':
      return buildFrequencyBarChart(options);
    case 'value':
      return buildValueBarChart(options);
  }
}

// ============================================================================
// Builder Registry Registration
// ============================================================================

import { registerBuilder } from './builder-registry';

function str(s: unknown): string {
  return s !== undefined && s !== null ? String(s) : '';
}

registerBuilder('bar-chart', (state) => {
  const df = str(state['dataframe']).trim();
  const xVariable = str(state['xVariable']).trim();
  const chartType = (str(state['chartType']) || '').trim() as 'frequency' | 'value' | '';
  const yVariable = str(state['yVariable']).trim();
  const type: 'frequency' | 'value' = chartType === 'value' || (chartType !== 'frequency' && yVariable) ? 'value' : 'frequency';
  const fillVariable = str(state['fillVariable']).trim() || undefined;
  const position = (str(state['position']) || undefined) as 'stack' | 'dodge' | 'fill' | undefined;
  const horizontal = state['horizontal'] === true;
  const title = str(state['title']).trim() || undefined;

  if (type === 'value') {
    return buildBarChart({ dataframe: df, type: 'value', xVariable, yVariable, fillVariable, position, horizontal, title });
  }
  return buildBarChart({ dataframe: df, type: 'frequency', xVariable, fillVariable, position, horizontal, title });
});
