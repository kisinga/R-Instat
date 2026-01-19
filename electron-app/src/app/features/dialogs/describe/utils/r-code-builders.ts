/**
 * R Code Builders
 *
 * Generates R code for describe operations: graphs, summaries, and frequencies.
 *
 * Architecture:
 * - Core r-codegen: Shared primitives and composition functions
 * - ggplot2 Helpers: Domain-specific ggplot layer builders
 * - Graph Builders: One pure function per graph type, returns complete ggplot code
 * - Summary/Frequency Builders: dplyr/tidyr chain construction for tabular outputs
 *
 * All functions are pure. Invalid inputs return R comment strings (e.g., "# Select...").
 *
 * @example
 * buildGraphCode({ dataframe: 'df', columns: ['x'], graphType: 'histogram' }, analysis)
 * // => 'ggplot(get_dataframe("df"), aes(x = x)) + geom_histogram(...) + ...'
 */

import {
  rStr,
  rBool,
  rVec,
  rParams,
  rDf,
  rCol,
  rPipe,
  rPlus,
  rFn,
  rIf,
} from '../../../../core/r-codegen';
import { GraphType, VariableAnalysis } from './variable-type-analyzer';

// ============================================================================
// Public Types
// ============================================================================

export type SummaryStatistic = 'n' | 'mean' | 'sd' | 'min' | 'max' | 'median' | 'sum' | 'var' | 'iqr';
export type SummaryMode = 'default' | 'customised' | 'skim';
export type FrequencyDisplay = 'count' | 'row' | 'column' | 'cell';

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

export interface SummaryOptions {
  mode: SummaryMode;
  statistics?: SummaryStatistic[];
  omitMissing?: boolean;
  groupBy?: string;
}

export interface FrequencyOptions {
  display: FrequencyDisplay;
  showCount?: boolean;
  showRowPercent?: boolean;
  showColPercent?: boolean;
  showCellPercent?: boolean;
  weights?: string;
}

export interface DescribeOptions {
  dataframe: string;
  columns: string[];
}

// ============================================================================
// ggplot2 Layer Builders (Domain-specific helpers)
// ============================================================================

/** Build aes() string from mappings */
function ggAes(mappings: Record<string, string | undefined>): string {
  const parts = Object.entries(mappings)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${v}`);
  return `aes(${parts.join(', ')})`;
}

/** ggplot base: ggplot(data, aes(...)) */
function ggBase(df: string, aes: string): string {
  return `ggplot(${rDf(df)}, ${aes})`;
}

/** facet_wrap layer (returns undefined if no facet) */
const ggFacet = (by?: string): string | undefined => (by ? `facet_wrap(~ ${by})` : undefined);

/** coord_flip layer (returns undefined if not flipping) */
const ggFlip = (flip?: boolean): string | undefined => (flip ? 'coord_flip()' : undefined);

/** theme layer */
const ggTheme = (name = 'minimal'): string => `theme_${name}()`;

/** labs() layer for titles and axis labels */
function ggLabs(opts: { title?: string; x?: string; y?: string; fill?: string }): string {
  const params = Object.entries(opts)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} = ${rStr(v as string)}`);
  return `labs(${params.join(', ')})`;
}

// ============================================================================
// Axis Resolution Helpers
// ============================================================================

interface AxisMapping {
  x: string | undefined;
  y: string;
}

/**
 * Resolve x/y axes from explicit column order.
 * 
 * The columns array follows explicit role assignment:
 * - columns[0]: Primary variable (Analyze) - typically Y-axis
 * - columns[1]: Grouping variable (GroupBy) - typically X-axis
 * 
 * This replaces the old type-inferring approach with explicit user intent.
 */
function resolveAxesFromColumns(columns: string[], graphType: GraphType): AxisMapping {
  const primaryVar = columns[0];
  const groupingVar = columns.length > 1 ? columns[1] : undefined;
  
  // Distribution graphs: primary variable on X-axis
  if (['histogram', 'density', 'bar-chart', 'pie-chart'].includes(graphType)) {
    return { x: primaryVar, y: 'count' };
  }
  
  // Scatter/line: if no grouping, use columns[0] as Y, columns[1] as X
  // If we have explicit grouping, use it as X
  if (['scatter', 'line'].includes(graphType)) {
    if (columns.length >= 2) {
      return { x: groupingVar!, y: primaryVar };
    }
    return { x: undefined, y: primaryVar };
  }
  
  // Comparison graphs (boxplot, violin, jitter, etc.): grouping on X, primary on Y
  return { x: groupingVar, y: primaryVar };
}

/**
 * Legacy axis resolution for backward compatibility.
 * @deprecated Use resolveAxesFromColumns with explicit column order instead.
 */
function resolveNumCatAxes(columns: string[], analysis: VariableAnalysis): AxisMapping {
  if (analysis.combination === 'single-numeric') {
    return { x: undefined, y: columns[0] };
  }

  // Use column order: first = primary (Y), second = grouping (X)
  const primaryVar = columns[0];
  const groupingVar = columns.length > 1 ? columns[1] : undefined;

  return {
    x: groupingVar,
    y: primaryVar,
  };
}

// ============================================================================
// Graph Builders
// ============================================================================

type GraphBuildContext = DescribeOptions & GraphOptions & { analysis: VariableAnalysis };

function buildHistogram(ctx: GraphBuildContext): string {
  const { dataframe, columns, bins = 30, alpha = 0.8, fillBy, facetBy, title, xLabel } = ctx;
  
  // Multi-column: pivot to long format and facet by variable name
  if (columns.length > 1) {
    const colsVec = rVec(columns, true);
    const pivotPipe = rPipe(
      rDf(dataframe),
      `tidyr::pivot_longer(cols = ${colsVec}, names_to = "variable", values_to = "value")`
    );
    return rPlus(
      `${pivotPipe} %>%\n  ggplot(aes(x = value, fill = variable))`,
      `geom_histogram(bins = ${bins}, alpha = ${alpha}, color = "white")`,
      'facet_wrap(~ variable, scales = "free")',
      ggTheme(),
      ggLabs({ title: title ?? 'Histograms', x: xLabel ?? 'Value', y: 'Count' })
    );
  }

  // Single column: original behavior
  const col = columns[0];
  return rPlus(
    ggBase(dataframe, ggAes({ x: col, fill: fillBy })),
    `geom_histogram(bins = ${bins}, alpha = ${alpha}, color = "white")`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `Histogram of ${col}`, x: xLabel ?? col, y: 'Count' })
  );
}

function buildDensity(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.6, colorBy, fillBy, facetBy, title, xLabel } = ctx;
  
  // Multi-column: pivot to long format and facet by variable name
  if (columns.length > 1) {
    const colsVec = rVec(columns, true);
    const pivotPipe = rPipe(
      rDf(dataframe),
      `tidyr::pivot_longer(cols = ${colsVec}, names_to = "variable", values_to = "value")`
    );
    return rPlus(
      `${pivotPipe} %>%\n  ggplot(aes(x = value, fill = variable, color = variable))`,
      `geom_density(alpha = ${alpha})`,
      'facet_wrap(~ variable, scales = "free")',
      ggTheme(),
      ggLabs({ title: title ?? 'Density Plots', x: xLabel ?? 'Value', y: 'Density' })
    );
  }

  // Single column: original behavior
  const col = columns[0];
  return rPlus(
    ggBase(dataframe, ggAes({ x: col, color: colorBy, fill: fillBy })),
    `geom_density(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `Density Plot of ${col}`, x: xLabel ?? col, y: 'Density' })
  );
}

function buildBoxplot(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.8, fillBy, facetBy, flipCoords, title, analysis } = ctx;
  
  // Multi-column with all numeric: pivot to long format and facet
  if (columns.length > 1 && analysis.combination === 'multi-numeric') {
    const colsVec = rVec(columns, true);
    const pivotPipe = rPipe(
      rDf(dataframe),
      `tidyr::pivot_longer(cols = ${colsVec}, names_to = "variable", values_to = "value")`
    );
    return rPlus(
      `${pivotPipe} %>%\n  ggplot(aes(x = variable, y = value, fill = variable))`,
      `geom_boxplot(alpha = ${alpha})`,
      ggFlip(flipCoords),
      ggTheme(),
      ggLabs({ title: title ?? 'Boxplots', x: 'Variable', y: 'Value' })
    );
  }

  // Single column or numeric-by-categorical: original behavior
  const { x: xVar, y: yVar } = resolveNumCatAxes(columns, analysis);
  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    `geom_boxplot(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `Boxplot of ${yVar}` })
  );
}

function buildViolin(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.8, fillBy, facetBy, flipCoords, title, analysis } = ctx;
  
  // Multi-column with all numeric: pivot to long format
  if (columns.length > 1 && analysis.combination === 'multi-numeric') {
    const colsVec = rVec(columns, true);
    const pivotPipe = rPipe(
      rDf(dataframe),
      `tidyr::pivot_longer(cols = ${colsVec}, names_to = "variable", values_to = "value")`
    );
    return rPlus(
      `${pivotPipe} %>%\n  ggplot(aes(x = variable, y = value, fill = variable))`,
      `geom_violin(alpha = ${alpha})`,
      ggFlip(flipCoords),
      ggTheme(),
      ggLabs({ title: title ?? 'Violin Plots', x: 'Variable', y: 'Value' })
    );
  }

  // Single column or numeric-by-categorical: original behavior
  let { x: xVar, y: yVar } = resolveNumCatAxes(columns, analysis);

  // Violin needs an x grouping; use placeholder if single numeric
  if (!xVar && analysis.combination === 'single-numeric') {
    xVar = '"all"';
  }

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    `geom_violin(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `Violin Plot of ${yVar}` })
  );
}

function buildBarChart(ctx: GraphBuildContext): string {
  const {
    dataframe,
    columns,
    position = 'stack',
    fillBy,
    facetBy,
    flipCoords,
    showLabels,
    title,
    xLabel,
  } = ctx;
  const col = columns[0];

  return rPlus(
    ggBase(dataframe, ggAes({ x: col, fill: fillBy ?? col })),
    `geom_bar(position = ${rStr(position)}, alpha = 0.8)`,
    rIf(!!showLabels, 'geom_text(stat = "count", aes(label = after_stat(count)), vjust = -0.5)'),
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `Bar Chart of ${col}`, x: xLabel ?? col, y: 'Count' })
  );
}

function buildPieChart(ctx: GraphBuildContext): string {
  const { dataframe, columns, title } = ctx;
  const col = columns[0];

  // Pie = bar with polar coords; requires count transformation
  const dataPipe = rPipe(rDf(dataframe), `dplyr::count(${col})`);

  return rPlus(
    `${dataPipe} %>%\n  ggplot(aes(x = "", y = n, fill = ${col}))`,
    'geom_bar(stat = "identity", width = 1)',
    'coord_polar("y", start = 0)',
    'theme_void()',
    `labs(title = ${rStr(title ?? `Distribution of ${col}`)}, fill = ${rStr(col)})`
  );
}

function buildScatter(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.6, colorBy, facetBy, title, xLabel, yLabel } = ctx;

  if (columns.length < 2) {
    return '# Select two numeric variables for scatter plot';
  }

  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns[1];

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, color: colorBy })),
    `geom_point(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} vs ${xVar}`, x: xLabel ?? xVar, y: yLabel ?? yVar })
  );
}

function buildScatterMatrix(ctx: GraphBuildContext): string {
  const { dataframe, columns, colorBy, title } = ctx;
  const colsStr = rVec(columns, true);

  let code = `GGally::ggpairs(${rDf(dataframe)}, columns = ${colsStr}`;
  if (colorBy) {
    code += `, mapping = aes(color = ${colorBy})`;
  }
  code += `, title = ${rStr(title ?? 'Scatter Matrix')})`;

  return code;
}

function buildJitter(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.5, colorBy, facetBy, flipCoords, title } = ctx;
  
  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns.length > 1 ? columns[1] : '"all"';

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, color: colorBy ?? xVar })),
    `geom_jitter(width = 0.2, alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} by ${xVar}` })
  );
}

function buildMosaic(ctx: GraphBuildContext): string {
  const { dataframe, columns, title } = ctx;

  if (columns.length < 2) {
    return '# Select two categorical variables for mosaic plot';
  }

  // Explicit role pattern: columns[0] = primary, columns[1] = grouping
  const primaryVar = columns[0];
  const groupingVar = columns[1];

  return rPlus(
    `ggplot(${rDf(dataframe)})`,
    `ggmosaic::geom_mosaic(aes(x = ggmosaic::product(${groupingVar}, ${primaryVar}), fill = ${groupingVar}))`,
    ggTheme(),
    ggLabs({ title: title ?? `${primaryVar} by ${groupingVar}` })
  );
}

function buildCorrelationHeatmap(ctx: GraphBuildContext): string {
  const { dataframe, columns, title } = ctx;
  const colsStr = rVec(columns, true);

  const dataPipe = rPipe(
    rDf(dataframe),
    `dplyr::select(${colsStr})`,
    'cor(use = "pairwise.complete.obs")',
    'as.data.frame()',
    'tibble::rownames_to_column("var1")',
    'tidyr::pivot_longer(-var1, names_to = "var2", values_to = "correlation")'
  );

  return rPlus(
    `${dataPipe} %>%\n  ggplot(aes(x = var1, y = var2, fill = correlation))`,
    'geom_tile()',
    'scale_fill_gradient2(low = "blue", mid = "white", high = "red", midpoint = 0)',
    'theme_minimal()',
    `labs(title = ${rStr(title ?? 'Correlation Heatmap')})`
  );
}

// ============================================================================
// Composite Graph Builders
// ============================================================================

/**
 * Boxplot with jittered data points overlay.
 * Shows distribution summary (boxplot) with individual observations (jitter).
 */
function buildBoxplotJitter(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.4, fillBy, facetBy, flipCoords, title } = ctx;
  
  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns.length > 1 ? columns[1] : '"all"';

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    'geom_boxplot(outlier.shape = NA, alpha = 0.7)',
    `geom_jitter(width = 0.2, alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} by ${xVar}` })
  );
}

/**
 * Violin plot with boxplot inside.
 * Shows density shape (violin) with quartile summary (boxplot).
 */
function buildViolinBoxplot(ctx: GraphBuildContext): string {
  const { dataframe, columns, fillBy, facetBy, flipCoords, title } = ctx;
  
  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns.length > 1 ? columns[1] : '"all"';

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    'geom_violin(alpha = 0.7)',
    'geom_boxplot(width = 0.1, fill = "white", alpha = 0.8)',
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} by ${xVar}` })
  );
}

/**
 * Violin plot with jittered data points.
 * Shows density shape (violin) with individual observations (jitter).
 */
function buildViolinJitter(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.4, fillBy, facetBy, flipCoords, title } = ctx;
  
  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns.length > 1 ? columns[1] : '"all"';

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    'geom_violin(alpha = 0.7)',
    `geom_jitter(width = 0.15, alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} by ${xVar}` })
  );
}

/**
 * Summary plot with mean crossbar and error bars.
 * Shows group means with standard error bars.
 */
function buildSummaryPlot(ctx: GraphBuildContext): string {
  const { dataframe, columns, colorBy, facetBy, flipCoords, title } = ctx;
  
  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns.length > 1 ? columns[1] : '"all"';

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, color: colorBy ?? xVar })),
    'stat_summary(fun = mean, geom = "crossbar", width = 0.5, linewidth = 0.8)',
    'stat_summary(fun.data = mean_se, geom = "errorbar", width = 0.2)',
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `Mean of ${yVar} by ${xVar}` })
  );
}

/**
 * Line plot connecting data points.
 * Shows trend over ordered variable.
 */
function buildLinePlot(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.8, colorBy, facetBy, title, xLabel, yLabel } = ctx;

  if (columns.length < 2) {
    return '# Select two variables for line plot';
  }

  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns[1];

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, color: colorBy, group: colorBy ?? '1' })),
    `geom_line(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} over ${xVar}`, x: xLabel ?? xVar, y: yLabel ?? yVar })
  );
}

/**
 * Line plot with data points.
 * Shows trend with individual observations.
 */
function buildLinePoints(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.8, colorBy, facetBy, title, xLabel, yLabel } = ctx;

  if (columns.length < 2) {
    return '# Select two variables for line plot';
  }

  // Explicit role pattern: columns[0] = primary (Y), columns[1] = grouping (X)
  const yVar = columns[0];
  const xVar = columns[1];

  return rPlus(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, color: colorBy, group: colorBy ?? '1' })),
    `geom_line(alpha = ${alpha})`,
    'geom_point(size = 2)',
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} over ${xVar}`, x: xLabel ?? xVar, y: yLabel ?? yVar })
  );
}

// ============================================================================
// Graph Builder Registry
// ============================================================================

type GraphBuilder = (ctx: GraphBuildContext) => string;

const GRAPH_BUILDERS: Record<GraphType, GraphBuilder> = {
  // Single variable
  histogram: buildHistogram,
  density: buildDensity,
  boxplot: buildBoxplot,
  violin: buildViolin,
  'bar-chart': buildBarChart,
  'pie-chart': buildPieChart,
  // Two variable
  scatter: buildScatter,
  line: buildLinePlot,
  'scatter-matrix': buildScatterMatrix,
  jitter: buildJitter,
  mosaic: buildMosaic,
  'stacked-bar': (ctx) => buildBarChart({ ...ctx, position: 'stack' }),
  'grouped-bar': (ctx) => buildBarChart({ ...ctx, position: 'dodge' }),
  // Composite graphs
  'boxplot-jitter': buildBoxplotJitter,
  'violin-boxplot': buildViolinBoxplot,
  'violin-jitter': buildViolinJitter,
  'summary-plot': buildSummaryPlot,
  'line-points': buildLinePoints,
  // Multi-variable
  'correlation-heatmap': buildCorrelationHeatmap,
};

// ============================================================================
// Summary Builders
// ============================================================================

function buildDefaultSummary(opts: DescribeOptions): string {
  const { dataframe, columns } = opts;

  if (columns.length === 0) {
    return `summary(${rDf(dataframe)})`;
  }

  return rPipe(rDf(dataframe), `dplyr::select(${rVec(columns)})`, 'summary()');
}

function buildSkimSummary(opts: DescribeOptions): string {
  const { dataframe, columns } = opts;

  if (columns.length === 0) {
    return `skimr::skim_without_charts(${rDf(dataframe)})`;
  }

  return rPipe(rDf(dataframe), `skimr::skim_without_charts(${columns.join(', ')})`);
}

/** Map statistic name to dplyr across formula */
function statToFormula(stat: SummaryStatistic, naRm: string): string {
  const formulas: Record<SummaryStatistic, string> = {
    n: 'n = ~dplyr::n()',
    mean: `mean = ~mean(.x, na.rm = ${naRm})`,
    sd: `sd = ~sd(.x, na.rm = ${naRm})`,
    min: `min = ~min(.x, na.rm = ${naRm})`,
    max: `max = ~max(.x, na.rm = ${naRm})`,
    median: `median = ~median(.x, na.rm = ${naRm})`,
    sum: `sum = ~sum(.x, na.rm = ${naRm})`,
    var: `var = ~var(.x, na.rm = ${naRm})`,
    iqr: `iqr = ~IQR(.x, na.rm = ${naRm})`,
  };
  return formulas[stat];
}

function buildCustomSummary(
  opts: DescribeOptions,
  statistics: SummaryStatistic[],
  omitMissing: boolean,
  groupBy?: string
): string {
  const { dataframe, columns } = opts;
  const naRm = rBool(omitMissing);

  const statFns = statistics.map((s) => statToFormula(s, naRm)).filter(Boolean);
  if (statFns.length === 0) {
    return '# Select at least one statistic';
  }

  const colSelector = columns.length > 0 ? 'everything()' : 'where(is.numeric)';

  return rPipe(
    rDf(dataframe),
    rIf(!!groupBy, `dplyr::group_by(${groupBy})`),
    rIf(columns.length > 0, `dplyr::select(${rVec(columns)})`),
    `dplyr::summarise(
    dplyr::across(
      ${colSelector},
      list(${statFns.join(', ')})
    )
  )`
  );
}

// ============================================================================
// Frequency Builders
// ============================================================================

function buildOneWayFrequency(opts: DescribeOptions & FrequencyOptions): string {
  const { dataframe, columns, weights } = opts;
  const col = columns[0];

  let code = `sjmisc::frq(${rCol(dataframe, col)}`;
  if (weights) {
    code += `, weights = ${rCol(dataframe, weights)}`;
  }
  code += ')';

  return code;
}

function buildTwoWayFrequency(opts: DescribeOptions & FrequencyOptions): string {
  const {
    dataframe,
    columns,
    showCount = true,
    showRowPercent = false,
    showColPercent = false,
    weights,
  } = opts;
  const [rowVar, colVar] = columns;

  const params = rParams({
    'show.obs': showCount,
    'show.row.prc': showRowPercent,
    'show.col.prc': showColPercent,
  });

  let code = `sjPlot::sjtab(${rCol(dataframe, rowVar)}, ${rCol(dataframe, colVar)},
    ${params}`;

  if (weights) {
    code += `,
    weight.by = ${rCol(dataframe, weights)}`;
  }

  code += ')';
  return code;
}

// ============================================================================
// Public API
// ============================================================================

/** Build ggplot2 graph code based on options and variable analysis */
export function buildGraphCode(
  options: DescribeOptions & GraphOptions,
  analysis: VariableAnalysis
): string {
  const builder = GRAPH_BUILDERS[options.graphType];
  if (!builder) {
    return `# Unsupported graph type: ${options.graphType}`;
  }

  const ctx: GraphBuildContext = { ...options, analysis };
  return builder(ctx);
}

/** Build summary statistics code (R summary, skimr, or custom dplyr) */
export function buildSummaryCode(options: DescribeOptions & SummaryOptions): string {
  const {
    dataframe,
    columns,
    mode,
    statistics = ['n', 'mean', 'sd', 'min', 'max'],
    omitMissing = true,
    groupBy,
  } = options;

  switch (mode) {
    case 'skim':
      return buildSkimSummary({ dataframe, columns });
    case 'default':
      return buildDefaultSummary({ dataframe, columns });
    case 'customised':
      return buildCustomSummary({ dataframe, columns }, statistics, omitMissing, groupBy);
    default:
      return '# Unknown summary mode';
  }
}

/** Build frequency table code (sjmisc::frq for 1-way, sjPlot::sjtab for 2-way) */
export function buildFrequencyCode(options: DescribeOptions & FrequencyOptions): string {
  const { columns } = options;

  if (columns.length === 0) {
    return '# Select at least one variable';
  }

  if (columns.length === 1) {
    return buildOneWayFrequency(options);
  }

  return buildTwoWayFrequency(options);
}
