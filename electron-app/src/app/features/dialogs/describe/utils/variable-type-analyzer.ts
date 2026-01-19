/**
 * Variable Type Analyzer
 * 
 * Centralizes type detection logic for the Describe dialog.
 * Determines the best output options based on selected variables and their types.
 */

import { ColumnInfo } from '../../../../core/models/r.model';

/** Normalized variable type */
export type VariableType = 'numeric' | 'categorical';

/** Combination of variable types for determining available outputs */
export type VariableCombination =
  | 'none'
  | 'single-numeric'
  | 'single-categorical'
  | 'multi-numeric'
  | 'multi-categorical'
  | 'numeric-by-categorical'
  | 'categorical-by-numeric'
  | 'categorical-by-categorical'
  | 'mixed';

/** Available graph types based on variable combination */
export type GraphType =
  // Single variable
  | 'histogram'
  | 'density'
  | 'boxplot'
  | 'violin'
  | 'bar-chart'
  | 'pie-chart'
  // Two variable
  | 'scatter'
  | 'line'
  | 'jitter'
  | 'summary-plot'
  | 'mosaic'
  | 'stacked-bar'
  | 'grouped-bar'
  // Composite graphs (multiple geoms)
  | 'boxplot-jitter'
  | 'violin-boxplot'
  | 'violin-jitter'
  | 'line-points'
  // Multi-variable
  | 'scatter-matrix'
  | 'correlation-heatmap';

/** Graph configuration with metadata */
export interface GraphConfig {
  type: GraphType;
  label: string;
  description: string;
  requiresNumeric: boolean;
  requiresCategorical: boolean;
}

/** Complete analysis of selected variables */
export interface VariableAnalysis {
  /** Selected column information */
  selectedColumns: ColumnInfo[];
  /** Normalized types of each variable */
  types: VariableType[];
  /** Detected combination pattern */
  combination: VariableCombination;
  /** Number of numeric variables */
  numericCount: number;
  /** Number of categorical variables */
  categoricalCount: number;
  /** Recommended graphs for this combination */
  recommendedGraphs: GraphType[];
  /** Whether summary statistics are meaningful */
  supportsSummary: boolean;
  /** Whether frequency tables are meaningful */
  supportsFrequency: boolean;
  /** Default graph type for this combination */
  defaultGraph: GraphType | null;
}

// ============================================================================
// Graph Mode Configuration
// ============================================================================

/** Graph mode for Describe dialog */
export type GraphMode = 'distribution' | 'comparison' | 'faceted';

/** Configuration for each graph mode */
export interface GraphModeConfig {
  /** Display label for UI */
  label: string;
  /** Subtitle hint describing the mode */
  hint: string;
  /** Graph types available in this mode */
  allowedGraphs: GraphType[];
  /** Whether multiple analyze variables are allowed */
  allowMultipleAnalyze: boolean;
  /** Whether to show Group By field */
  showGroupBy: boolean;
  /** Whether to show Facet By field */
  showFacetBy: boolean;
}

/** All graph types for faceted mode (all support faceting) */
const ALL_GRAPH_TYPES: GraphType[] = [
  'histogram', 'density', 'boxplot', 'violin', 'bar-chart', 'pie-chart',
  'scatter', 'line', 'jitter', 'summary-plot', 'mosaic', 'stacked-bar', 'grouped-bar',
  'boxplot-jitter', 'violin-boxplot', 'violin-jitter', 'line-points',
  'scatter-matrix', 'correlation-heatmap'
];

/** Graph mode configurations - single source of truth for mode behavior */
export const GRAPH_MODE_CONFIGS: Record<GraphMode, GraphModeConfig> = {
  distribution: {
    label: 'Distribution',
    hint: 'Explore one variable\'s shape and spread',
    allowedGraphs: ['histogram', 'density', 'boxplot', 'violin', 'bar-chart', 'pie-chart'],
    allowMultipleAnalyze: false,
    showGroupBy: false,
    showFacetBy: false,
  },
  comparison: {
    label: 'Comparison',
    hint: 'Compare variable(s) against a grouping factor',
    allowedGraphs: [
      'scatter', 'line', 'line-points', 'boxplot', 'violin', 'jitter',
      'boxplot-jitter', 'violin-boxplot', 'violin-jitter', 'summary-plot',
      'scatter-matrix', 'correlation-heatmap', 'stacked-bar', 'grouped-bar', 'mosaic',
      'histogram', 'density' // For faceted single-var with multiple analyze vars
    ],
    allowMultipleAnalyze: true,
    showGroupBy: true,
    showFacetBy: false,
  },
  faceted: {
    label: 'Faceted',
    hint: 'Split into panels by a third variable',
    allowedGraphs: ALL_GRAPH_TYPES,
    allowMultipleAnalyze: true,
    showGroupBy: true,
    showFacetBy: true,
  },
};

/**
 * Filter graphs by mode - returns only graphs allowed in the given mode.
 * Pure function for testability.
 */
export function filterGraphsByMode(graphs: GraphType[], mode: GraphMode): GraphType[] {
  const allowed = GRAPH_MODE_CONFIGS[mode].allowedGraphs;
  return graphs.filter(g => allowed.includes(g));
}

/** All available graph configurations */
export const GRAPH_CONFIGS: Record<GraphType, GraphConfig> = {
  // Single numeric
  histogram: {
    type: 'histogram',
    label: 'Histogram',
    description: 'Distribution of a single numeric variable',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  density: {
    type: 'density',
    label: 'Density Plot',
    description: 'Smoothed distribution curve',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  boxplot: {
    type: 'boxplot',
    label: 'Boxplot',
    description: 'Box and whisker plot showing quartiles',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  violin: {
    type: 'violin',
    label: 'Violin Plot',
    description: 'Density + boxplot combination',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  // Single categorical
  'bar-chart': {
    type: 'bar-chart',
    label: 'Bar Chart',
    description: 'Counts by category',
    requiresNumeric: false,
    requiresCategorical: true,
  },
  'pie-chart': {
    type: 'pie-chart',
    label: 'Pie Chart',
    description: 'Proportions by category',
    requiresNumeric: false,
    requiresCategorical: true,
  },
  // Two variable - numeric by numeric
  scatter: {
    type: 'scatter',
    label: 'Scatter Plot',
    description: 'X-Y relationship between two numeric variables',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  line: {
    type: 'line',
    label: 'Line Plot',
    description: 'Connected points showing trend',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  // Two variable - numeric by categorical
  jitter: {
    type: 'jitter',
    label: 'Jitter Plot',
    description: 'Points with random horizontal offset',
    requiresNumeric: true,
    requiresCategorical: true,
  },
  'summary-plot': {
    type: 'summary-plot',
    label: 'Summary Plot',
    description: 'Mean with error bars by group',
    requiresNumeric: true,
    requiresCategorical: true,
  },
  // Two variable - categorical by categorical
  mosaic: {
    type: 'mosaic',
    label: 'Mosaic Plot',
    description: 'Proportional areas by two categories',
    requiresNumeric: false,
    requiresCategorical: true,
  },
  'stacked-bar': {
    type: 'stacked-bar',
    label: 'Stacked Bar Chart',
    description: 'Bars stacked by second category',
    requiresNumeric: false,
    requiresCategorical: true,
  },
  'grouped-bar': {
    type: 'grouped-bar',
    label: 'Grouped Bar Chart',
    description: 'Bars side by side by second category',
    requiresNumeric: false,
    requiresCategorical: true,
  },
  // Composite graphs (multiple geoms)
  'boxplot-jitter': {
    type: 'boxplot-jitter',
    label: 'Boxplot + Points',
    description: 'Boxplot with jittered data points overlay',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  'violin-boxplot': {
    type: 'violin-boxplot',
    label: 'Violin + Boxplot',
    description: 'Violin plot with boxplot inside',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  'violin-jitter': {
    type: 'violin-jitter',
    label: 'Violin + Points',
    description: 'Violin plot with jittered data points',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  'line-points': {
    type: 'line-points',
    label: 'Line + Points',
    description: 'Line plot with data points',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  // Multi-variable
  'scatter-matrix': {
    type: 'scatter-matrix',
    label: 'Scatter Matrix',
    description: 'Pairwise scatter plots (ggpairs)',
    requiresNumeric: true,
    requiresCategorical: false,
  },
  'correlation-heatmap': {
    type: 'correlation-heatmap',
    label: 'Correlation Heatmap',
    description: 'Heatmap of correlation coefficients',
    requiresNumeric: true,
    requiresCategorical: false,
  },
};

/**
 * Normalize R column type to simple numeric/categorical
 */
export function normalizeType(rType: string): VariableType {
  const lower = rType.toLowerCase();
  if (
    lower.includes('numeric') ||
    lower.includes('integer') ||
    lower.includes('double') ||
    lower.includes('real')
  ) {
    return 'numeric';
  }
  // Everything else is categorical (factor, character, logical, etc.)
  return 'categorical';
}

/**
 * Determine the combination pattern from variable types
 */
export function determineCombination(types: VariableType[]): VariableCombination {
  if (types.length === 0) {
    return 'none';
  }

  const numericCount = types.filter(t => t === 'numeric').length;
  const categoricalCount = types.filter(t => t === 'categorical').length;

  if (types.length === 1) {
    return types[0] === 'numeric' ? 'single-numeric' : 'single-categorical';
  }

  if (types.length === 2) {
    if (numericCount === 2) return 'multi-numeric';
    if (categoricalCount === 2) return 'categorical-by-categorical';
    // One of each - order matters for UX, but we treat symmetrically
    return numericCount === 1 ? 'numeric-by-categorical' : 'categorical-by-numeric';
  }

  // 3+ variables
  if (numericCount === types.length) return 'multi-numeric';
  if (categoricalCount === types.length) return 'multi-categorical';
  return 'mixed';
}

/**
 * Get recommended graphs for a given combination
 */
export function getRecommendedGraphs(combination: VariableCombination): GraphType[] {
  switch (combination) {
    case 'none':
      return [];
    case 'single-numeric':
      return ['histogram', 'density', 'boxplot', 'violin'];
    case 'single-categorical':
      return ['bar-chart', 'pie-chart'];
    case 'multi-numeric':
      // Include single-var graphs (histogram, etc.) which will be faceted per variable
      return [
        'histogram', 'density', 'boxplot', 'violin',  // Faceted single-var graphs
        'scatter', 'line', 'line-points', 'scatter-matrix', 'correlation-heatmap'
      ];
    case 'multi-categorical':
      return ['stacked-bar', 'grouped-bar', 'mosaic'];
    case 'numeric-by-categorical':
    case 'categorical-by-numeric':
      // Include composite graphs for richer visualization options
      return [
        'boxplot', 'violin', 'jitter', 
        'boxplot-jitter', 'violin-boxplot', 'violin-jitter',
        'summary-plot', 'histogram', 'density'
      ];
    case 'categorical-by-categorical':
      return ['stacked-bar', 'grouped-bar', 'mosaic'];
    case 'mixed':
      // For mixed types, scatter-matrix (ggpairs) handles this well
      return ['scatter-matrix', 'boxplot', 'scatter', 'bar-chart'];
  }
}

/**
 * Get the default graph for a combination
 */
export function getDefaultGraph(combination: VariableCombination): GraphType | null {
  switch (combination) {
    case 'none':
      return null;
    case 'single-numeric':
      return 'histogram';
    case 'single-categorical':
      return 'bar-chart';
    case 'multi-numeric':
      return 'scatter';
    case 'multi-categorical':
      return 'stacked-bar';
    case 'numeric-by-categorical':
    case 'categorical-by-numeric':
      return 'boxplot';
    case 'categorical-by-categorical':
      return 'stacked-bar';
    case 'mixed':
      return 'boxplot';
  }
}

/**
 * Analyze selected variables and return complete analysis
 */
export function analyzeVariables(selectedColumns: ColumnInfo[]): VariableAnalysis {
  const types = selectedColumns.map(col => normalizeType(col.type));
  const combination = determineCombination(types);
  const numericCount = types.filter(t => t === 'numeric').length;
  const categoricalCount = types.filter(t => t === 'categorical').length;

  return {
    selectedColumns,
    types,
    combination,
    numericCount,
    categoricalCount,
    recommendedGraphs: getRecommendedGraphs(combination),
    // Summary works for any selection (categorical gets frequency counts via summary())
    supportsSummary: selectedColumns.length > 0,
    // Frequency works for any variable (numeric will be binned or show unique values)
    supportsFrequency: selectedColumns.length > 0,
    defaultGraph: getDefaultGraph(combination),
  };
}

/**
 * Get graph configs for recommended graphs
 */
export function getGraphConfigsForAnalysis(analysis: VariableAnalysis): GraphConfig[] {
  return analysis.recommendedGraphs.map(type => GRAPH_CONFIGS[type]);
}
