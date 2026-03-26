/**
 * Graph Builders
 *
 * Composable framework for generating R code for different graph types.
 * Uses shared helper functions for composition and type-safe options.
 *
 * Graph Types:
 * - Boxplot: Numeric y variable, optional factor x, optional fill, optional jitter
 * - Histogram: Single numeric variable, bins, fill color, optional facet
 * - Scatter: Two numeric variables (x, y), optional color by factor, optional trend line
 */

import { RSyntax, rSyntax, rFn, rStr, rPlus, rAssign, RFunction, ROperator } from '../../r-codegen';
import { ggBase, ggAes, ggFacet, ggFlip, ggTheme, ggLabs } from '../../r-codegen/ggplot-helpers';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Base options common to all graph types
 */
interface BaseGraphOptions {
  /** Dataframe name */
  dataframe: string;
  /** Chart title */
  title?: string;
  /** Output graph name for assignment */
  name?: string;
}

/**
 * Boxplot Options
 *
 * Boxplots show distribution of numeric variable, optionally grouped by factor.
 */
export interface BoxplotOptions extends BaseGraphOptions {
  /** Y-axis variable (numeric) - required */
  yVariable: string;
  /** X-axis variable (factor/categorical) - optional, for grouping */
  xVariable?: string;
  /** Fill variable (factor) - optional, for color grouping */
  fillVariable?: string;
  /** Whether to show jitter points overlaid */
  showPoints?: boolean;
}

/**
 * Histogram Options
 *
 * Histograms show distribution of a single numeric variable.
 */
export interface HistogramOptions extends BaseGraphOptions {
  /** Variable to plot (numeric) - required */
  variable: string;
  /** Number of bins */
  bins?: number;
  /** Fill color (hex color string) */
  fillColor?: string;
  /** Facet variable (factor) - optional, for splitting into panels */
  facetBy?: string;
}

/**
 * Scatter Plot Options
 *
 * Scatter plots show relationship between two numeric variables.
 */
export interface ScatterOptions extends BaseGraphOptions {
  /** X-axis variable (numeric) - required */
  xVariable: string;
  /** Y-axis variable (numeric) - required */
  yVariable: string;
  /** Color variable (factor) - optional, for color grouping */
  colorVariable?: string;
  /** Whether to add trend line (regression line) */
  addTrendLine?: boolean;
}

// ============================================================================
// Shared Helper Functions
// ============================================================================

/**
 * Build common ggplot layers
 *
 * Extracts shared logic for all graph types: base, theme, labs, assignment.
 *
 * @param options - Base graph options
 * @param baseCode - The ggplot base code (from ggBase + geom)
 * @returns RSyntax instance
 */
function buildGraphCommon(
  options: BaseGraphOptions,
  baseCode: string
): RSyntax {
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
// Individual Builders
// ============================================================================

/**
 * Build R code for a boxplot
 *
 * Boxplots show distribution of numeric variable, optionally grouped by factor.
 * Can overlay jitter points for better data visibility.
 *
 * @param options - Boxplot configuration
 * @returns RSyntax instance with ggplot2 code
 */
export function buildBoxplot(options: BoxplotOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.yVariable) {
    return rSyntax().setBase('# Select a Y variable');
  }

  // Build aesthetics mapping
  const aesMappings: Record<string, string | undefined> = {
    y: options.yVariable,
    x: options.xVariable,
    fill: options.fillVariable,
  };

  // Build layers
  const layers: Array<string | RFunction | ROperator | undefined> = [
    ggBase(options.dataframe, ggAes(aesMappings)),
    rFn('geom_boxplot', {
      alpha: '0.7',
    }),
    options.showPoints
      ? rFn('geom_jitter', {
          width: '0.2',
          alpha: '0.5',
          size: '1',
        })
      : undefined,
    ggTheme(),
    ggLabs({
      title: options.title || `Box Plot of ${options.yVariable}`,
      x: options.xVariable || undefined,
      y: options.yVariable,
    }),
  ];

  const baseCode = rPlus(...layers);
  return buildGraphCommon(options, baseCode);
}

/**
 * Build R code for a histogram
 *
 * Histograms show distribution of a single numeric variable.
 * Can be faceted by a factor variable to show multiple distributions.
 *
 * @param options - Histogram configuration
 * @returns RSyntax instance with ggplot2 code
 */
export function buildHistogram(options: HistogramOptions): RSyntax {
  // Validation
  if (!options.dataframe) {
    return rSyntax().setBase('# Select a dataframe first');
  }

  if (!options.variable) {
    return rSyntax().setBase('# Select a variable');
  }

  // Build aesthetics mapping
  const aesMappings: Record<string, string | undefined> = {
    x: options.variable,
  };

  // Build layers
  const layers: Array<string | RFunction | ROperator | undefined> = [
    ggBase(options.dataframe, ggAes(aesMappings)),
    rFn('geom_histogram', {
      bins: options.bins ? String(options.bins) : undefined,
      fill: options.fillColor ? rStr(options.fillColor) : undefined,
      color: options.fillColor ? rStr('white') : undefined,
      alpha: '0.8',
    }),
    options.facetBy ? ggFacet(options.facetBy) : undefined,
    ggTheme(),
    ggLabs({
      title: options.title || `Histogram of ${options.variable}`,
      x: options.variable,
      y: 'Count',
    }),
  ];

  const baseCode = rPlus(...layers);
  return buildGraphCommon(options, baseCode);
}

/**
 * Build R code for a scatter plot
 *
 * Scatter plots show relationship between two numeric variables.
 * Can color by factor variable and add regression trend line.
 *
 * @param options - Scatter plot configuration
 * @returns RSyntax instance with ggplot2 code
 */
export function buildScatter(options: ScatterOptions): RSyntax {
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

  // Build aesthetics mapping
  const aesMappings: Record<string, string | undefined> = {
    x: options.xVariable,
    y: options.yVariable,
    color: options.colorVariable,
  };

  // Build layers
  const layers: Array<string | RFunction | ROperator | undefined> = [
    ggBase(options.dataframe, ggAes(aesMappings)),
    rFn('geom_point', {
      alpha: '0.7',
      size: '2',
    }),
    options.addTrendLine
      ? rFn('geom_smooth', {
          method: rStr('lm'),
          se: 'TRUE',
          alpha: '0.2',
        })
      : undefined,
    ggTheme(),
    ggLabs({
      title: options.title || `${options.yVariable} vs ${options.xVariable}`,
      x: options.xVariable,
      y: options.yVariable,
    }),
  ];

  const baseCode = rPlus(...layers);
  return buildGraphCommon(options, baseCode);
}

// ============================================================================
// Builder Registry Registrations
// ============================================================================

import { registerBuilder } from './builder-registry';

function str(s: unknown): string {
  return s !== undefined && s !== null ? String(s) : '';
}

registerBuilder('histogram', (state) => {
  const df = str(state['dataframe']).trim();
  return buildHistogram({
    dataframe: df,
    variable: str(state['variable']).trim(),
    bins: typeof state['bins'] === 'number' ? state['bins'] : undefined,
    fillColor: str(state['fillColor']) || undefined,
    facetBy: str(state['facetBy']).trim() || undefined,
    title: str(state['title']).trim() || undefined,
  });
});

registerBuilder('boxplot', (state) => {
  const df = str(state['dataframe']).trim();
  return buildBoxplot({
    dataframe: df,
    yVariable: str(state['yVariable']).trim(),
    xVariable: str(state['xVariable']).trim() || undefined,
    fillVariable: str(state['fillVariable']).trim() || undefined,
    showPoints: state['showPoints'] === true,
  });
});

registerBuilder('scatter', (state) => {
  const df = str(state['dataframe']).trim();
  return buildScatter({
    dataframe: df,
    xVariable: str(state['xVariable']).trim(),
    yVariable: str(state['yVariable']).trim(),
    colorVariable: str(state['colorVariable']).trim() || undefined,
    addTrendLine: state['addTrendLine'] === true,
  });
});
