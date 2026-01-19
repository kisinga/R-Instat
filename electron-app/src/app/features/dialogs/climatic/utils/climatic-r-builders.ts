/**
 * Climatic R Code Builders
 *
 * Pure functions for generating R code for climatic analysis.
 * Uses the core r-codegen module for composable R code generation.
 */

import { rStr, rDf, rBool, rPipe, rPlus, rFn, rIf } from '../../../../core/r-codegen';
import {
  ClimaticSummaryOptions,
  InventoryPlotOptions,
  ClimaticSummaryFunction,
  SummaryLevel,
} from './climatic-types';

// ============================================================================
// Date Extraction Helpers
// ============================================================================

/**
 * Convert date column to Date type using base R.
 * Handles both Date objects (pass-through) and character strings (ISO format).
 */
const rParseDate = (dateCol: string): string => `as.Date(${dateCol})`;

/** Extract year from date column using base R format() */
export const rExtractYear = (dateCol: string): string =>
  `as.integer(format(${rParseDate(dateCol)}, "%Y"))`;

/** Extract month from date column using base R format() */
export const rExtractMonth = (dateCol: string): string =>
  `as.integer(format(${rParseDate(dateCol)}, "%m"))`;

/** Extract day of year from date column using base R format() */
export const rExtractDoy = (dateCol: string): string =>
  `as.integer(format(${rParseDate(dateCol)}, "%j"))`;

// ============================================================================
// Summary Function Mapping
// ============================================================================

function getSummaryExpression(func: ClimaticSummaryFunction, col: string, naRm: boolean): string {
  const naArg = naRm ? ', na.rm = TRUE' : '';

  switch (func) {
    case 'sum':
      return `sum(${col}${naArg})`;
    case 'mean':
      return `mean(${col}${naArg})`;
    case 'max':
      return `max(${col}${naArg})`;
    case 'min':
      return `min(${col}${naArg})`;
    case 'count':
      return `n()`;
    case 'count_missing':
      return `sum(is.na(${col}))`;
    default:
      return `sum(${col}${naArg})`;
  }
}

function getSummaryLabel(func: ClimaticSummaryFunction): string {
  switch (func) {
    case 'sum':
      return 'total';
    case 'mean':
      return 'mean';
    case 'max':
      return 'max';
    case 'min':
      return 'min';
    case 'count':
      return 'n';
    case 'count_missing':
      return 'n_missing';
    default:
      return 'result';
  }
}

// ============================================================================
// Grouping Helpers
// ============================================================================

function getGroupByColumns(level: SummaryLevel, stationCol?: string): string[] {
  const groups: string[] = [];

  if (stationCol) {
    groups.push(stationCol);
  }

  switch (level) {
    case 'annual':
      groups.push('year');
      break;
    case 'monthly':
      groups.push('year', 'month');
      break;
    case 'daily':
      groups.push('year', 'doy');
      break;
    case 'station':
      // Only group by station (already added if present)
      break;
  }

  return groups;
}

function getMutateParams(
  level: SummaryLevel,
  dateCol: string
): Record<string, string> | undefined {
  switch (level) {
    case 'annual':
      return { year: rExtractYear(dateCol) };
    case 'monthly':
      return { year: rExtractYear(dateCol), month: rExtractMonth(dateCol) };
    case 'daily':
      return { year: rExtractYear(dateCol), doy: rExtractDoy(dateCol) };
    case 'station':
      return undefined;
    default:
      return undefined;
  }
}

// ============================================================================
// Climatic Summary Builder
// ============================================================================

/**
 * Build R code for climatic summary
 *
 * @example
 * buildClimaticSummary({
 *   dataframe: 'dodoma',
 *   dateColumn: 'date',
 *   elementColumn: 'rain',
 *   stationColumn: 'station',
 *   level: 'annual',
 *   summaryFunction: 'sum',
 *   omitMissing: true
 * })
 * // Returns:
 * // get_dataframe("dodoma") %>%
 * //   mutate(year = as.integer(format(as.Date(date), "%Y"))) %>%
 * //   group_by(station, year) %>%
 * //   summarise(total = sum(rain, na.rm = TRUE), .groups = "drop")
 */
export function buildClimaticSummary(opts: ClimaticSummaryOptions): string {
  const { dataframe, dateColumn, elementColumn, stationColumn, level, summaryFunction, omitMissing } =
    opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const mutateParams = getMutateParams(level, dateColumn);
  const groupCols = getGroupByColumns(level, stationColumn);
  const summaryExpr = getSummaryExpression(summaryFunction, elementColumn, omitMissing);
  const summaryLabel = getSummaryLabel(summaryFunction);

  return rPipe(
    rDf(dataframe),
    rIf(!!mutateParams, rFn('mutate', mutateParams)),
    rIf(groupCols.length > 0, `group_by(${groupCols.join(', ')})`),
    rFn('summarise', { [summaryLabel]: summaryExpr, '.groups': '"drop"' })
  );
}

// ============================================================================
// Inventory Plot Builder
// ============================================================================

/**
 * Build R code for inventory plot (data availability heatmap)
 *
 * @example
 * buildInventoryPlot({
 *   dataframe: 'dodoma',
 *   dateColumn: 'date',
 *   elementColumn: 'rain',
 *   stationColumn: 'station',
 *   facetByStation: true,
 *   flipCoords: false,
 *   presentColor: '#22c55e',
 *   missingColor: '#ef4444'
 * })
 */
export function buildInventoryPlot(opts: InventoryPlotOptions): string {
  const {
    dataframe,
    dateColumn,
    elementColumn,
    stationColumn,
    facetByStation,
    flipCoords,
    title,
    presentColor,
    missingColor,
  } = opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  // Data preparation pipeline
  const dataPipe = rPipe(
    rDf(dataframe),
    rFn('mutate', {
      year: rExtractYear(dateColumn),
      doy: rExtractDoy(dateColumn),
      has_data: `!is.na(${elementColumn})`,
    })
  );

  // ggplot layers
  return rPlus(
    `${dataPipe} %>%\n  ggplot(aes(x = doy, y = factor(year), fill = has_data))`,
    'geom_tile()',
    `scale_fill_manual(values = c("FALSE" = ${rStr(missingColor)}, "TRUE" = ${rStr(presentColor)}), labels = c("Missing", "Present"), name = "Data")`,
    rIf(facetByStation && !!stationColumn, `facet_wrap(~ ${stationColumn})`),
    rIf(!!flipCoords, 'coord_flip()'),
    'theme_minimal()',
    rFn('labs', {
      title: rStr(title || 'Data Availability Inventory'),
      x: '"Day of Year"',
      y: '"Year"',
    })
  );
}

// ============================================================================
// Annual Rainfall Builder
// ============================================================================

export interface AnnualRainfallOptions {
  dataframe: string;
  dateColumn: string;
  rainColumn: string;
  stationColumn?: string;
}

export function buildAnnualRainfall(opts: AnnualRainfallOptions): string {
  const { dataframe, dateColumn, rainColumn, stationColumn } = opts;

  if (!dataframe || !dateColumn || !rainColumn) {
    return '# Select dataframe, date column, and rain column';
  }

  const groupCols = stationColumn ? [stationColumn, 'year'] : ['year'];

  return rPipe(
    rDf(dataframe),
    rFn('mutate', { year: rExtractYear(dateColumn) }),
    `group_by(${groupCols.join(', ')})`,
    rFn('summarise', { annual_rain: `sum(${rainColumn}, na.rm = TRUE)`, '.groups': '"drop"' })
  );
}

// ============================================================================
// Extremes Builder
// ============================================================================

export interface ExtremesOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  level: 'annual' | 'monthly';
  findMax: boolean;
  findMin: boolean;
}

export function buildExtremes(opts: ExtremesOptions): string {
  const { dataframe, dateColumn, elementColumn, stationColumn, level, findMax, findMin } = opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const groupParts: string[] = [];
  if (stationColumn) groupParts.push(stationColumn);
  groupParts.push('year');
  if (level === 'monthly') groupParts.push('month');

  const mutateParams =
    level === 'monthly'
      ? { year: rExtractYear(dateColumn), month: rExtractMonth(dateColumn) }
      : { year: rExtractYear(dateColumn) };

  const summaryParams: Record<string, string> = {};
  if (findMax) summaryParams[`max_${elementColumn}`] = `max(${elementColumn}, na.rm = TRUE)`;
  if (findMin) summaryParams[`min_${elementColumn}`] = `min(${elementColumn}, na.rm = TRUE)`;

  // Default to max if neither selected
  if (!findMax && !findMin) {
    summaryParams[`max_${elementColumn}`] = `max(${elementColumn}, na.rm = TRUE)`;
  }
  summaryParams['.groups'] = '"drop"';

  return rPipe(
    rDf(dataframe),
    rFn('mutate', mutateParams),
    `group_by(${groupParts.join(', ')})`,
    rFn('summarise', summaryParams)
  );
}

// ============================================================================
// Day Count Builder
// ============================================================================

export interface DayCountOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  threshold: number;
  operator: '>=' | '>' | '<=' | '<';
}

export function buildDayCount(opts: DayCountOptions): string {
  const { dataframe, dateColumn, elementColumn, stationColumn, threshold, operator } = opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const groupCols = stationColumn ? [stationColumn, 'year'] : ['year'];
  const condition = `${elementColumn} ${operator} ${threshold}`;

  return rPipe(
    rDf(dataframe),
    rFn('mutate', { year: rExtractYear(dateColumn) }),
    `group_by(${groupCols.join(', ')})`,
    rFn('summarise', { day_count: `sum(${condition}, na.rm = TRUE)`, '.groups': '"drop"' })
  );
}

// ============================================================================
// Spell Lengths Builder
// ============================================================================

export interface SpellLengthsOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  threshold: number;
  spellType: 'wet' | 'dry';
  statistic: 'max' | 'mean' | 'count';
}

export function buildSpellLengths(opts: SpellLengthsOptions): string {
  const { dataframe, dateColumn, elementColumn, stationColumn, threshold, spellType, statistic } =
    opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const groupCols = stationColumn ? [stationColumn, 'year'] : ['year'];
  const condition = spellType === 'wet' ? `${elementColumn} >= ${threshold}` : `${elementColumn} < ${threshold}`;

  const spellLabel = `${spellType}_spell`;

  // Build the statistic expression that works inside summarise
  // Uses inline computation to avoid list column issues
  const rleExpr = `{ r <- rle(is_${spellType}); lens <- r$lengths[r$values == TRUE]; if(length(lens) > 0)`;
  let statExpr: string;
  switch (statistic) {
    case 'max':
      statExpr = `${rleExpr} max(lens) else NA_integer_ }`;
      break;
    case 'mean':
      statExpr = `${rleExpr} mean(lens) else NA_real_ }`;
      break;
    case 'count':
      statExpr = `${rleExpr} length(lens) else 0L }`;
      break;
    default:
      statExpr = `${rleExpr} max(lens) else NA_integer_ }`;
  }

  const statLabel =
    statistic === 'count' ? `n_${spellLabel}s` : `${statistic}_${spellLabel}`;

  return rPipe(
    rDf(dataframe),
    rFn('mutate', { year: rExtractYear(dateColumn), [`is_${spellType}`]: condition }),
    `group_by(${groupCols.join(', ')})`,
    rFn('summarise', { [statLabel]: statExpr, '.groups': '"drop"' })
  );
}

// ============================================================================
// Seasonal Summary Builder
// ============================================================================

export interface SeasonalSummaryOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  summaryFunction: 'sum' | 'mean' | 'max' | 'min';
}

export function buildSeasonalSummary(opts: SeasonalSummaryOptions): string {
  const { dataframe, dateColumn, elementColumn, stationColumn, summaryFunction } = opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const groupCols = stationColumn ? [stationColumn, 'month'] : ['month'];

  return rPipe(
    rDf(dataframe),
    rFn('mutate', { month: rExtractMonth(dateColumn) }),
    `group_by(${groupCols.join(', ')})`,
    rFn('summarise', {
      [`${summaryFunction}_${elementColumn}`]: `${summaryFunction}(${elementColumn}, na.rm = TRUE)`,
      '.groups': '"drop"',
    })
  );
}

// ============================================================================
// Missing Report Builder
// ============================================================================

export interface MissingReportOptions {
  dataframe: string;
  dateColumn: string;
  elementColumns: string[];
  stationColumn?: string;
  level: 'annual' | 'monthly' | 'overall';
}

export function buildMissingReport(opts: MissingReportOptions): string {
  const { dataframe, dateColumn, elementColumns, stationColumn, level } = opts;

  if (!dataframe || !dateColumn || elementColumns.length === 0) {
    return '# Select dataframe, date column, and at least one element column';
  }

  const groupParts: string[] = [];
  if (stationColumn) groupParts.push(stationColumn);
  if (level === 'annual') groupParts.push('year');
  if (level === 'monthly') groupParts.push('year', 'month');

  const mutateParams: Record<string, string> | undefined =
    level === 'annual'
      ? { year: rExtractYear(dateColumn) }
      : level === 'monthly'
        ? { year: rExtractYear(dateColumn), month: rExtractMonth(dateColumn) }
        : undefined;

  // Build summary params for each column
  const summaryParams: Record<string, string> = {};
  elementColumns.forEach((col) => {
    summaryParams[`${col}_missing`] = `sum(is.na(${col}))`;
    summaryParams[`${col}_total`] = 'n()';
    summaryParams[`${col}_pct`] = `round(100 * sum(is.na(${col})) / n(), 1)`;
  });
  summaryParams['.groups'] = '"drop"';

  return rPipe(
    rDf(dataframe),
    rIf(!!mutateParams, rFn('mutate', mutateParams)),
    rIf(groupParts.length > 0, `group_by(${groupParts.join(', ')})`),
    rFn('summarise', summaryParams)
  );
}

// ============================================================================
// Temperature Summary Builder
// ============================================================================

export interface TemperatureSummaryOptions {
  dataframe: string;
  dateColumn: string;
  tmaxColumn?: string;
  tminColumn?: string;
  stationColumn?: string;
  level: 'annual' | 'monthly';
}

export function buildTemperatureSummary(opts: TemperatureSummaryOptions): string {
  const { dataframe, dateColumn, tmaxColumn, tminColumn, stationColumn, level } = opts;

  if (!dataframe || !dateColumn || (!tmaxColumn && !tminColumn)) {
    return '# Select dataframe, date column, and at least one temperature column';
  }

  const groupParts: string[] = [];
  if (stationColumn) groupParts.push(stationColumn);
  groupParts.push('year');
  if (level === 'monthly') groupParts.push('month');

  const mutateParams =
    level === 'monthly'
      ? { year: rExtractYear(dateColumn), month: rExtractMonth(dateColumn) }
      : { year: rExtractYear(dateColumn) };

  const summaryParams: Record<string, string> = {};
  if (tmaxColumn) {
    summaryParams['mean_tmax'] = `mean(${tmaxColumn}, na.rm = TRUE)`;
    summaryParams['max_tmax'] = `max(${tmaxColumn}, na.rm = TRUE)`;
  }
  if (tminColumn) {
    summaryParams['mean_tmin'] = `mean(${tminColumn}, na.rm = TRUE)`;
    summaryParams['min_tmin'] = `min(${tminColumn}, na.rm = TRUE)`;
  }
  summaryParams['.groups'] = '"drop"';

  return rPipe(
    rDf(dataframe),
    rFn('mutate', mutateParams),
    `group_by(${groupParts.join(', ')})`,
    rFn('summarise', summaryParams)
  );
}
