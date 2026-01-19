/**
 * R Code Builders
 *
 * Generates R code for describe operations: graphs, summaries, and frequencies.
 *
 * Architecture:
 * - R Primitives: Low-level R string formatting (rStr, rVec, rBool, rParams)
 * - ggplot2 Layers: Composable ggplot components (ggAes, ggFacet, ggLabs, etc.)
 * - Graph Builders: One pure function per graph type, returns complete ggplot code
 * - Pipe Builders: dplyr/tidyr chain construction for tabular outputs
 *
 * All functions are pure. Invalid inputs return R comment strings (e.g., "# Select...").
 *
 * @example
 * buildGraphCode({ dataframe: 'df', columns: ['x'], graphType: 'histogram' }, analysis)
 * // => 'ggplot(get_dataframe("df"), aes(x = x)) + geom_histogram(...) + ...'
 */

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
// R Primitives
// ============================================================================

/** R string literal with escaped quotes */
const rStr = (s: string): string => `"${s.replace(/"/g, '\\"')}"`;

/** R boolean literal */
const rBool = (b: boolean): string => (b ? 'TRUE' : 'FALSE');

/** R vector: c("a", "b") or single value if length 1 */
function rVec(items: string[], quote = true): string {
  if (items.length === 0) return '';
  const formatted = items.map(item => (quote ? rStr(item) : item));
  return items.length === 1 ? formatted[0] : `c(${formatted.join(', ')})`;
}

/** Named R parameters: key = value, key2 = value2 */
function rParams(obj: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(obj)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      if (typeof v === 'boolean') return `${k} = ${rBool(v)}`;
      if (typeof v === 'number') return `${k} = ${v}`;
      return `${k} = ${v}`;
    })
    .join(', ');
}

/** Dataframe accessor via bridge function */
const rDf = (name: string): string => `get_dataframe(${rStr(name)})`;

/** Column accessor: df$col */
const rCol = (df: string, col: string): string => `${rDf(df)}$${col}`;

// ============================================================================
// ggplot2 Layer Builders
// ============================================================================

/** Join ggplot layers with + operator, filtering undefined/empty */
function ggLayers(...layers: (string | undefined | null)[]): string {
  return layers.filter(Boolean).join(' +\n  ');
}

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
const ggFacet = (by?: string): string | undefined =>
  by ? `facet_wrap(~ ${by})` : undefined;

/** coord_flip layer (returns undefined if not flipping) */
const ggFlip = (flip?: boolean): string | undefined =>
  flip ? 'coord_flip()' : undefined;

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

/** Resolve x/y axes for numeric-by-categorical patterns */
function resolveNumCatAxes(columns: string[], analysis: VariableAnalysis): AxisMapping {
  if (analysis.combination === 'single-numeric') {
    return { x: undefined, y: columns[0] };
  }

  const numericCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'numeric');
  const catCol = analysis.selectedColumns.find((_, i) => analysis.types[i] === 'categorical');

  return {
    x: catCol?.name,
    y: numericCol?.name ?? columns[0],
  };
}

// ============================================================================
// dplyr Pipe Builder
// ============================================================================

/** Join dplyr pipe steps with %>%, filtering undefined/empty */
function dplyrPipe(...steps: (string | undefined | null | false)[]): string {
  return steps.filter(Boolean).join(' %>%\n  ');
}

// ============================================================================
// Graph Builders
// ============================================================================

type GraphBuildContext = DescribeOptions & GraphOptions & { analysis: VariableAnalysis };

function buildHistogram(ctx: GraphBuildContext): string {
  const { dataframe, columns, bins = 30, alpha = 0.8, fillBy, facetBy, title, xLabel } = ctx;
  const col = columns[0];

  return ggLayers(
    ggBase(dataframe, ggAes({ x: col, fill: fillBy })),
    `geom_histogram(bins = ${bins}, alpha = ${alpha}, color = "white")`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `Histogram of ${col}`, x: xLabel ?? col, y: 'Count' })
  );
}

function buildDensity(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.6, colorBy, fillBy, facetBy, title, xLabel } = ctx;
  const col = columns[0];

  return ggLayers(
    ggBase(dataframe, ggAes({ x: col, color: colorBy, fill: fillBy })),
    `geom_density(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggTheme(),
    ggLabs({ title: title ?? `Density Plot of ${col}`, x: xLabel ?? col, y: 'Density' })
  );
}

function buildBoxplot(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.8, fillBy, facetBy, flipCoords, title, analysis } = ctx;
  const { x: xVar, y: yVar } = resolveNumCatAxes(columns, analysis);

  return ggLayers(
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
  let { x: xVar, y: yVar } = resolveNumCatAxes(columns, analysis);

  // Violin needs an x grouping; use placeholder if single numeric
  if (!xVar && analysis.combination === 'single-numeric') {
    xVar = '"all"';
  }

  return ggLayers(
    ggBase(dataframe, ggAes({ x: xVar, y: yVar, fill: fillBy ?? xVar })),
    `geom_violin(alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `Violin Plot of ${yVar}` })
  );
}

function buildBarChart(ctx: GraphBuildContext): string {
  const { dataframe, columns, position = 'stack', fillBy, facetBy, flipCoords, showLabels, title, xLabel } = ctx;
  const col = columns[0];

  return ggLayers(
    ggBase(dataframe, ggAes({ x: col, fill: fillBy ?? col })),
    `geom_bar(position = ${rStr(position)}, alpha = 0.8)`,
    showLabels ? 'geom_text(stat = "count", aes(label = after_stat(count)), vjust = -0.5)' : undefined,
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
  return dplyrPipe(
    rDf(dataframe),
    `dplyr::count(${col})`
  ) + ` %>%
  ggplot(aes(x = "", y = n, fill = ${col})) +
  geom_bar(stat = "identity", width = 1) +
  coord_polar("y", start = 0) +
  theme_void() +
  labs(title = ${rStr(title ?? `Distribution of ${col}`)}, fill = ${rStr(col)})`;
}

function buildScatter(ctx: GraphBuildContext): string {
  const { dataframe, columns, alpha = 0.6, colorBy, facetBy, title, xLabel, yLabel } = ctx;

  if (columns.length < 2) {
    return '# Select two numeric variables for scatter plot';
  }

  const [xVar, yVar] = columns;

  return ggLayers(
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
  const { dataframe, columns, alpha = 0.5, colorBy, facetBy, flipCoords, title, analysis } = ctx;
  const { x: xVar, y: yVar } = resolveNumCatAxes(columns, analysis);

  return ggLayers(
    ggBase(dataframe, ggAes({ x: xVar ?? columns[1], y: yVar, color: colorBy ?? xVar })),
    `geom_jitter(width = 0.2, alpha = ${alpha})`,
    ggFacet(facetBy),
    ggFlip(flipCoords),
    ggTheme(),
    ggLabs({ title: title ?? `${yVar} by ${xVar ?? columns[1]}` })
  );
}

function buildMosaic(ctx: GraphBuildContext): string {
  const { dataframe, columns, title } = ctx;

  if (columns.length < 2) {
    return '# Select two categorical variables for mosaic plot';
  }

  const [var1, var2] = columns;

  return ggLayers(
    `ggplot(${rDf(dataframe)})`,
    `ggmosaic::geom_mosaic(aes(x = ggmosaic::product(${var2}, ${var1}), fill = ${var2}))`,
    ggTheme(),
    ggLabs({ title: title ?? `${var1} by ${var2}` })
  );
}

function buildCorrelationHeatmap(ctx: GraphBuildContext): string {
  const { dataframe, columns, title } = ctx;
  const colsStr = rVec(columns, true);

  return dplyrPipe(
    rDf(dataframe),
    `dplyr::select(${colsStr})`,
    'cor(use = "pairwise.complete.obs")',
    'as.data.frame()',
    'tibble::rownames_to_column("var1")',
    'tidyr::pivot_longer(-var1, names_to = "var2", values_to = "correlation")'
  ) + ` %>%
  ggplot(aes(x = var1, y = var2, fill = correlation)) +
  geom_tile() +
  scale_fill_gradient2(low = "blue", mid = "white", high = "red", midpoint = 0) +
  theme_minimal() +
  labs(title = ${rStr(title ?? 'Correlation Heatmap')})`;
}

// ============================================================================
// Graph Builder Registry
// ============================================================================

type GraphBuilder = (ctx: GraphBuildContext) => string;

const GRAPH_BUILDERS: Record<GraphType, GraphBuilder> = {
  histogram: buildHistogram,
  density: buildDensity,
  boxplot: buildBoxplot,
  violin: buildViolin,
  'bar-chart': buildBarChart,
  'pie-chart': buildPieChart,
  scatter: buildScatter,
  line: buildScatter, // Line uses same logic as scatter
  'scatter-matrix': buildScatterMatrix,
  jitter: buildJitter,
  mosaic: buildMosaic,
  'stacked-bar': ctx => buildBarChart({ ...ctx, position: 'stack' }),
  'grouped-bar': ctx => buildBarChart({ ...ctx, position: 'dodge' }),
  'summary-plot': buildBoxplot, // Summary plot extends boxplot
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

  return dplyrPipe(
    rDf(dataframe),
    `dplyr::select(${rVec(columns)})`,
    'summary()'
  );
}

function buildSkimSummary(opts: DescribeOptions): string {
  const { dataframe, columns } = opts;

  if (columns.length === 0) {
    return `skimr::skim_without_charts(${rDf(dataframe)})`;
  }

  return dplyrPipe(
    rDf(dataframe),
    `skimr::skim_without_charts(${columns.join(', ')})`
  );
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

  const statFns = statistics.map(s => statToFormula(s, naRm)).filter(Boolean);
  if (statFns.length === 0) {
    return '# Select at least one statistic';
  }

  const colSelector = columns.length > 0 ? 'everything()' : 'where(is.numeric)';

  return dplyrPipe(
    rDf(dataframe),
    groupBy && `dplyr::group_by(${groupBy})`,
    columns.length > 0 && `dplyr::select(${rVec(columns)})`,
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
  const { dataframe, columns, showCount = true, showRowPercent = false, showColPercent = false, weights } = opts;
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
