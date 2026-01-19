/**
 * R Code Builders
 * 
 * Composable functions for generating R code for describe operations.
 * Follows patterns from VB dialogs but with cleaner, functional approach.
 */

import { GraphType, VariableAnalysis, VariableCombination } from './variable-type-analyzer';

/** Summary statistic types */
export type SummaryStatistic = 'n' | 'mean' | 'sd' | 'min' | 'max' | 'median' | 'sum' | 'var' | 'iqr';

/** Summary mode options */
export type SummaryMode = 'default' | 'customised' | 'skim';

/** Frequency display options */
export type FrequencyDisplay = 'count' | 'row' | 'column' | 'cell';

/** Graph options */
export interface GraphOptions {
  graphType: GraphType;
  flipCoords?: boolean;
  facetBy?: string;
  colorBy?: string;
  fillBy?: string;
  bins?: number;
  alpha?: number;
  position?: 'stack' | 'dodge' | 'fill' | 'identity';
  showLabels?: boolean;
  title?: string;
  xLabel?: string;
  yLabel?: string;
}

/** Summary options */
export interface SummaryOptions {
  mode: SummaryMode;
  statistics?: SummaryStatistic[];
  omitMissing?: boolean;
  groupBy?: string;
}

/** Frequency options */
export interface FrequencyOptions {
  display: FrequencyDisplay;
  showCount?: boolean;
  showRowPercent?: boolean;
  showColPercent?: boolean;
  showCellPercent?: boolean;
  weights?: string;
}

/** Base describe options */
export interface DescribeOptions {
  dataframe: string;
  columns: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quote a string for R
 */
function rQuote(s: string): string {
  return `"${s.replace(/"/g, '\\"')}"`;
}

/**
 * Format column names for R
 */
function formatColumns(columns: string[], quote = true): string {
  if (columns.length === 0) return '';
  if (columns.length === 1) {
    return quote ? rQuote(columns[0]) : columns[0];
  }
  const formatted = columns.map(c => (quote ? rQuote(c) : c)).join(', ');
  return `c(${formatted})`;
}

/**
 * Get dataframe accessor
 */
function getDataframe(name: string): string {
  return `get_dataframe(${rQuote(name)})`;
}

// ============================================================================
// Graph Code Builders
// ============================================================================

/**
 * Build ggplot base
 */
function buildGgplotBase(dataframe: string): string {
  return `ggplot(${getDataframe(dataframe)}`;
}

/**
 * Build aes() string
 */
function buildAes(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${v}`);
  return `aes(${parts.join(', ')})`;
}

/**
 * Build histogram R code
 */
function buildHistogram(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, bins = 30, alpha = 0.8, fillBy, facetBy, title, xLabel } = options;
  const col = columns[0];
  
  let aes = buildAes({ x: col, fill: fillBy });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_histogram(bins = ${bins}, alpha = ${alpha}, color = "white")`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `Histogram of ${col}`)}, x = ${rQuote(xLabel || col)}, y = "Count")`;

  return code;
}

/**
 * Build density plot R code
 */
function buildDensity(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, alpha = 0.6, colorBy, fillBy, facetBy, title, xLabel } = options;
  const col = columns[0];
  
  let aes = buildAes({ x: col, color: colorBy, fill: fillBy });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_density(alpha = ${alpha})`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `Density Plot of ${col}`)}, x = ${rQuote(xLabel || col)}, y = "Density")`;

  return code;
}

/**
 * Build boxplot R code
 */
function buildBoxplot(options: DescribeOptions & GraphOptions, analysis: VariableAnalysis): string {
  const { dataframe, columns, alpha = 0.8, fillBy, facetBy, flipCoords, title } = options;
  
  let xVar: string | undefined;
  let yVar: string;
  
  if (analysis.combination === 'single-numeric') {
    // Single numeric - no x axis grouping
    xVar = undefined;
    yVar = columns[0];
  } else if (analysis.combination === 'numeric-by-categorical' || analysis.combination === 'categorical-by-numeric') {
    // Find numeric and categorical
    const numericCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'numeric');
    const catCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'categorical');
    xVar = catCol?.name;
    yVar = numericCol?.name || columns[0];
  } else {
    yVar = columns[0];
    xVar = columns.length > 1 ? columns[1] : undefined;
  }

  let aes = buildAes({ x: xVar, y: yVar, fill: fillBy || xVar });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_boxplot(alpha = ${alpha})`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  if (flipCoords) {
    code += ` +
  coord_flip()`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `Boxplot of ${yVar}`)})`;

  return code;
}

/**
 * Build violin plot R code
 */
function buildViolin(options: DescribeOptions & GraphOptions, analysis: VariableAnalysis): string {
  const { dataframe, columns, alpha = 0.8, fillBy, facetBy, flipCoords, title } = options;
  
  let xVar: string | undefined;
  let yVar: string;
  
  if (analysis.combination === 'single-numeric') {
    xVar = '"all"';
    yVar = columns[0];
  } else {
    const numericCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'numeric');
    const catCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'categorical');
    xVar = catCol?.name;
    yVar = numericCol?.name || columns[0];
  }

  let aes = buildAes({ x: xVar, y: yVar, fill: fillBy || xVar });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_violin(alpha = ${alpha})`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  if (flipCoords) {
    code += ` +
  coord_flip()`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `Violin Plot of ${yVar}`)})`;

  return code;
}

/**
 * Build bar chart R code
 */
function buildBarChart(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, position = 'stack', fillBy, facetBy, flipCoords, showLabels, title, xLabel } = options;
  const col = columns[0];
  
  let aes = buildAes({ x: col, fill: fillBy || col });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_bar(position = ${rQuote(position)}, alpha = 0.8)`;

  if (showLabels) {
    code += ` +
  geom_text(stat = "count", aes(label = after_stat(count)), vjust = -0.5)`;
  }

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  if (flipCoords) {
    code += ` +
  coord_flip()`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `Bar Chart of ${col}`)}, x = ${rQuote(xLabel || col)}, y = "Count")`;

  return code;
}

/**
 * Build pie chart R code
 */
function buildPieChart(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, title } = options;
  const col = columns[0];
  
  // Pie charts in ggplot2 are bar charts with polar coordinates
  let code = `${getDataframe(dataframe)} %>%
  dplyr::count(${col}) %>%
  ggplot(aes(x = "", y = n, fill = ${col})) +
  geom_bar(stat = "identity", width = 1) +
  coord_polar("y", start = 0) +
  theme_void() +
  labs(title = ${rQuote(title || `Distribution of ${col}`)}, fill = ${rQuote(col)})`;

  return code;
}

/**
 * Build scatter plot R code
 */
function buildScatter(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, alpha = 0.6, colorBy, facetBy, title, xLabel, yLabel } = options;
  
  if (columns.length < 2) {
    return '# Select two numeric variables for scatter plot';
  }

  const xVar = columns[0];
  const yVar = columns[1];
  
  let aes = buildAes({ x: xVar, y: yVar, color: colorBy });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_point(alpha = ${alpha})`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `${yVar} vs ${xVar}`)}, x = ${rQuote(xLabel || xVar)}, y = ${rQuote(yLabel || yVar)})`;

  return code;
}

/**
 * Build scatter matrix R code (ggpairs)
 */
function buildScatterMatrix(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, colorBy, title } = options;
  
  const colsStr = formatColumns(columns, true);
  let code = `GGally::ggpairs(${getDataframe(dataframe)}, columns = ${colsStr}`;
  
  if (colorBy) {
    code += `, mapping = aes(color = ${colorBy})`;
  }
  
  code += `, title = ${rQuote(title || 'Scatter Matrix')})`;

  return code;
}

/**
 * Build jitter plot R code
 */
function buildJitter(options: DescribeOptions & GraphOptions, analysis: VariableAnalysis): string {
  const { dataframe, columns, alpha = 0.5, colorBy, facetBy, flipCoords, title } = options;
  
  const numericCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'numeric');
  const catCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'categorical');
  
  const xVar = catCol?.name || columns[1];
  const yVar = numericCol?.name || columns[0];

  let aes = buildAes({ x: xVar, y: yVar, color: colorBy || xVar });
  let code = `${buildGgplotBase(dataframe)}, ${aes}) +
  geom_jitter(width = 0.2, alpha = ${alpha})`;

  if (facetBy) {
    code += ` +
  facet_wrap(~ ${facetBy})`;
  }

  if (flipCoords) {
    code += ` +
  coord_flip()`;
  }

  code += ` +
  theme_minimal() +
  labs(title = ${rQuote(title || `${yVar} by ${xVar}`)})`;

  return code;
}

/**
 * Build mosaic plot R code
 */
function buildMosaic(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, title } = options;
  
  if (columns.length < 2) {
    return '# Select two categorical variables for mosaic plot';
  }

  const var1 = columns[0];
  const var2 = columns[1];

  let code = `ggplot(${getDataframe(dataframe)}) +
  ggmosaic::geom_mosaic(aes(x = ggmosaic::product(${var2}, ${var1}), fill = ${var2})) +
  theme_minimal() +
  labs(title = ${rQuote(title || `${var1} by ${var2}`)})`;

  return code;
}

/**
 * Main graph code builder
 */
export function buildGraphCode(options: DescribeOptions & GraphOptions, analysis: VariableAnalysis): string {
  switch (options.graphType) {
    case 'histogram':
      return buildHistogram(options);
    case 'density':
      return buildDensity(options);
    case 'boxplot':
      return buildBoxplot(options, analysis);
    case 'violin':
      return buildViolin(options, analysis);
    case 'bar-chart':
    case 'stacked-bar':
      return buildBarChart({ ...options, position: 'stack' });
    case 'grouped-bar':
      return buildBarChart({ ...options, position: 'dodge' });
    case 'pie-chart':
      return buildPieChart(options);
    case 'scatter':
    case 'line':
      return buildScatter(options);
    case 'scatter-matrix':
      return buildScatterMatrix(options);
    case 'jitter':
      return buildJitter(options, analysis);
    case 'mosaic':
      return buildMosaic(options);
    case 'summary-plot':
      // Summary plot is boxplot + mean crossbar
      return buildBoxplot(options, analysis);
    case 'correlation-heatmap':
      return buildCorrelationHeatmap(options);
    default:
      return '# Unsupported graph type';
  }
}

/**
 * Build correlation heatmap
 */
function buildCorrelationHeatmap(options: DescribeOptions & GraphOptions): string {
  const { dataframe, columns, title } = options;
  
  const colsStr = formatColumns(columns, true);
  
  return `${getDataframe(dataframe)} %>%
  dplyr::select(${colsStr}) %>%
  cor(use = "pairwise.complete.obs") %>%
  as.data.frame() %>%
  tibble::rownames_to_column("var1") %>%
  tidyr::pivot_longer(-var1, names_to = "var2", values_to = "correlation") %>%
  ggplot(aes(x = var1, y = var2, fill = correlation)) +
  geom_tile() +
  scale_fill_gradient2(low = "blue", mid = "white", high = "red", midpoint = 0) +
  theme_minimal() +
  labs(title = ${rQuote(title || 'Correlation Heatmap')})`;
}

// ============================================================================
// Summary Code Builders
// ============================================================================

/**
 * Build summary R code
 */
export function buildSummaryCode(options: DescribeOptions & SummaryOptions): string {
  const { dataframe, columns, mode, statistics = ['n', 'mean', 'sd', 'min', 'max'], omitMissing = true, groupBy } = options;

  if (mode === 'skim') {
    return buildSkimCode(options);
  }

  if (mode === 'default') {
    return buildDefaultSummary(options);
  }

  // Customised mode
  return buildCustomSummary(options, statistics, omitMissing, groupBy);
}

/**
 * Build default summary (R's summary function)
 */
function buildDefaultSummary(options: DescribeOptions): string {
  const { dataframe, columns } = options;
  
  if (columns.length === 0) {
    return `summary(${getDataframe(dataframe)})`;
  }

  const colsStr = formatColumns(columns, true);
  return `${getDataframe(dataframe)} %>%
  dplyr::select(${colsStr}) %>%
  summary()`;
}

/**
 * Build skimr summary
 */
function buildSkimCode(options: DescribeOptions): string {
  const { dataframe, columns } = options;
  
  if (columns.length === 0) {
    return `skimr::skim(${getDataframe(dataframe)})`;
  }

  const colsStr = columns.join(', ');
  return `${getDataframe(dataframe)} %>%
  skimr::skim(${colsStr})`;
}

/**
 * Build customised summary with dplyr
 */
function buildCustomSummary(
  options: DescribeOptions,
  statistics: SummaryStatistic[],
  omitMissing: boolean,
  groupBy?: string
): string {
  const { dataframe, columns } = options;
  const naRm = omitMissing ? 'TRUE' : 'FALSE';

  const statFunctions = statistics.map(stat => {
    switch (stat) {
      case 'n': return `n = ~dplyr::n()`;
      case 'mean': return `mean = ~mean(.x, na.rm = ${naRm})`;
      case 'sd': return `sd = ~sd(.x, na.rm = ${naRm})`;
      case 'min': return `min = ~min(.x, na.rm = ${naRm})`;
      case 'max': return `max = ~max(.x, na.rm = ${naRm})`;
      case 'median': return `median = ~median(.x, na.rm = ${naRm})`;
      case 'sum': return `sum = ~sum(.x, na.rm = ${naRm})`;
      case 'var': return `var = ~var(.x, na.rm = ${naRm})`;
      case 'iqr': return `iqr = ~IQR(.x, na.rm = ${naRm})`;
      default: return '';
    }
  }).filter(Boolean);

  if (statFunctions.length === 0) {
    return '# Select at least one statistic';
  }

  const colsStr = columns.length > 0 ? formatColumns(columns, true) : 'where(is.numeric)';
  
  let code = `${getDataframe(dataframe)}`;
  
  if (groupBy) {
    code += ` %>%
  dplyr::group_by(${groupBy})`;
  }

  if (columns.length > 0) {
    code += ` %>%
  dplyr::select(${colsStr})`;
  }

  code += ` %>%
  dplyr::summarise(
    dplyr::across(
      ${columns.length > 0 ? 'everything()' : 'where(is.numeric)'},
      list(${statFunctions.join(', ')})
    )
  )`;

  return code;
}

// ============================================================================
// Frequency Code Builders
// ============================================================================

/**
 * Build frequency table R code
 */
export function buildFrequencyCode(options: DescribeOptions & FrequencyOptions): string {
  const { dataframe, columns, display, showCount = true, showRowPercent = false, showColPercent = false, showCellPercent = false, weights } = options;

  if (columns.length === 0) {
    return '# Select at least one variable';
  }

  if (columns.length === 1) {
    return buildOneWayFrequency(options);
  }

  return buildTwoWayFrequency(options);
}

/**
 * Build one-way frequency table
 */
function buildOneWayFrequency(options: DescribeOptions & FrequencyOptions): string {
  const { dataframe, columns, weights } = options;
  const col = columns[0];

  let code = `${getDataframe(dataframe)} %>%
  dplyr::count(${col}`;
  
  if (weights) {
    code += `, wt = ${weights}`;
  }

  code += `) %>%
  dplyr::mutate(
    percent = n / sum(n) * 100,
    cumulative = cumsum(percent)
  )`;

  return code;
}

/**
 * Build two-way frequency table using dplyr/tidyr (no janitor dependency)
 */
function buildTwoWayFrequency(options: DescribeOptions & FrequencyOptions): string {
  const { dataframe, columns, showCount, showRowPercent, showColPercent, weights } = options;
  const rowVar = columns[0];
  const colVar = columns[1];

  // Base cross-tabulation with dplyr
  let code = `${getDataframe(dataframe)} %>%
  dplyr::count(${rowVar}, ${colVar}`;

  if (weights) {
    code += `, wt = ${weights}`;
  }

  code += `)`;

  // Add percentages if requested
  if (showRowPercent) {
    code += ` %>%
  dplyr::group_by(${rowVar}) %>%
  dplyr::mutate(row_pct = n / sum(n) * 100) %>%
  dplyr::ungroup()`;
  }

  if (showColPercent) {
    code += ` %>%
  dplyr::group_by(${colVar}) %>%
  dplyr::mutate(col_pct = n / sum(n) * 100) %>%
  dplyr::ungroup()`;
  }

  // Pivot to wide format for traditional crosstab view
  if (showCount && !showRowPercent && !showColPercent) {
    code += ` %>%
  tidyr::pivot_wider(names_from = ${colVar}, values_from = n, values_fill = 0)`;
  }

  return code;
}
