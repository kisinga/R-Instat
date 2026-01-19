/**
 * Climatic R Code Builders
 * 
 * Pure functions for generating R code for climatic analysis.
 * Follows the composable pattern from describe/utils/r-code-builders.ts
 */

import {
  ClimaticSummaryOptions,
  InventoryPlotOptions,
  ClimaticSummaryFunction,
  SummaryLevel,
} from './climatic-types';

// ============================================================================
// R Primitives (reused pattern)
// ============================================================================

/** R string literal with escaped quotes */
const rStr = (s: string): string => `"${s.replace(/"/g, '\\"')}"`;

/** R boolean literal */
const rBool = (b: boolean): string => (b ? 'TRUE' : 'FALSE');

/** Dataframe accessor via bridge function */
const rDf = (name: string): string => `get_dataframe(${rStr(name)})`;

// ============================================================================
// Date Extraction Helpers
// ============================================================================

/** Extract year from date column using lubridate */
export const rExtractYear = (dateCol: string): string => `year(${dateCol})`;

/** Extract month from date column using lubridate */
export const rExtractMonth = (dateCol: string): string => `month(${dateCol})`;

/** Extract day of year from date column using lubridate */
export const rExtractDoy = (dateCol: string): string => `yday(${dateCol})`;

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
    case 'sum': return 'total';
    case 'mean': return 'mean';
    case 'max': return 'max';
    case 'min': return 'min';
    case 'count': return 'n';
    case 'count_missing': return 'n_missing';
    default: return 'result';
  }
}

// ============================================================================
// Grouping Helpers
// ============================================================================

function getGroupByColumns(level: SummaryLevel, dateCol: string, stationCol?: string): string[] {
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

function getMutateStep(level: SummaryLevel, dateCol: string): string | null {
  switch (level) {
    case 'annual':
      return `mutate(year = ${rExtractYear(dateCol)})`;
    case 'monthly':
      return `mutate(year = ${rExtractYear(dateCol)}, month = ${rExtractMonth(dateCol)})`;
    case 'daily':
      return `mutate(year = ${rExtractYear(dateCol)}, doy = ${rExtractDoy(dateCol)})`;
    case 'station':
      return null; // No date extraction needed
    default:
      return null;
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
 * //   mutate(year = year(date)) %>%
 * //   group_by(station, year) %>%
 * //   summarise(total = sum(rain, na.rm = TRUE), .groups = "drop")
 */
export function buildClimaticSummary(opts: ClimaticSummaryOptions): string {
  const {
    dataframe,
    dateColumn,
    elementColumn,
    stationColumn,
    level,
    summaryFunction,
    omitMissing,
  } = opts;

  if (!dataframe || !dateColumn || !elementColumn) {
    return '# Select dataframe, date column, and element column';
  }

  const steps: string[] = [];
  
  // Start with dataframe
  steps.push(rDf(dataframe));
  
  // Add mutate step for date extraction if needed
  const mutateStep = getMutateStep(level, dateColumn);
  if (mutateStep) {
    steps.push(mutateStep);
  }
  
  // Build group_by
  const groupCols = getGroupByColumns(level, dateColumn, stationColumn);
  if (groupCols.length > 0) {
    steps.push(`group_by(${groupCols.join(', ')})`);
  }
  
  // Build summarise
  const summaryExpr = getSummaryExpression(summaryFunction, elementColumn, omitMissing);
  const summaryLabel = getSummaryLabel(summaryFunction);
  steps.push(`summarise(${summaryLabel} = ${summaryExpr}, .groups = "drop")`);

  return steps.join(' %>%\n  ');
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

  const lines: string[] = [];
  
  // Data preparation
  lines.push(`${rDf(dataframe)} %>%`);
  lines.push(`  mutate(`);
  lines.push(`    year = ${rExtractYear(dateColumn)},`);
  lines.push(`    doy = ${rExtractDoy(dateColumn)},`);
  lines.push(`    has_data = !is.na(${elementColumn})`);
  lines.push(`  ) %>%`);
  
  // ggplot base
  lines.push(`  ggplot(aes(x = doy, y = factor(year), fill = has_data)) +`);
  lines.push(`  geom_tile() +`);
  
  // Color scale
  lines.push(`  scale_fill_manual(`);
  lines.push(`    values = c("FALSE" = ${rStr(missingColor)}, "TRUE" = ${rStr(presentColor)}),`);
  lines.push(`    labels = c("Missing", "Present"),`);
  lines.push(`    name = "Data"`);
  lines.push(`  ) +`);
  
  // Faceting
  if (facetByStation && stationColumn) {
    lines.push(`  facet_wrap(~ ${stationColumn}) +`);
  }
  
  // Coord flip
  if (flipCoords) {
    lines.push(`  coord_flip() +`);
  }
  
  // Theme and labels
  lines.push(`  theme_minimal() +`);
  lines.push(`  labs(`);
  lines.push(`    title = ${rStr(title || 'Data Availability Inventory')},`);
  lines.push(`    x = "Day of Year",`);
  lines.push(`    y = "Year"`);
  lines.push(`  )`);

  return lines.join('\n');
}
