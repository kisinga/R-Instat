/**
 * Climatic Types
 * 
 * Type definitions for climatic analysis dialogs.
 */

/** Semantic column types for climatic data */
export type ClimaticColumnType = 'date' | 'element' | 'station' | 'year' | 'doy';

/** Extended column info with climatic semantics */
export interface ClimaticColumnInfo {
  name: string;
  type: string;
  climaticType?: ClimaticColumnType;
}

/** Summary aggregation levels */
export type SummaryLevel = 'annual' | 'monthly' | 'daily' | 'station';

/** Available summary functions */
export type ClimaticSummaryFunction = 'sum' | 'mean' | 'max' | 'min' | 'count' | 'count_missing';

/** Options for climatic summary dialog */
export interface ClimaticSummaryOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  level: SummaryLevel;
  summaryFunction: ClimaticSummaryFunction;
  omitMissing: boolean;
}

/** Options for inventory plot dialog */
export interface InventoryPlotOptions {
  dataframe: string;
  dateColumn: string;
  elementColumn: string;
  stationColumn?: string;
  facetByStation: boolean;
  flipCoords: boolean;
  title?: string;
  presentColor: string;
  missingColor: string;
}

/** Default options for climatic summary */
export const DEFAULT_SUMMARY_OPTIONS: Partial<ClimaticSummaryOptions> = {
  level: 'annual',
  summaryFunction: 'sum',
  omitMissing: true,
};

/** Default options for inventory plot */
export const DEFAULT_INVENTORY_OPTIONS: Partial<InventoryPlotOptions> = {
  facetByStation: false,
  flipCoords: false,
  presentColor: '#22c55e',
  missingColor: '#ef4444',
};

/** Summary function display info */
export const SUMMARY_FUNCTIONS: { value: ClimaticSummaryFunction; labelKey: string }[] = [
  { value: 'sum', labelKey: 'CLIMATIC.FUNC_SUM' },
  { value: 'mean', labelKey: 'CLIMATIC.FUNC_MEAN' },
  { value: 'max', labelKey: 'CLIMATIC.FUNC_MAX' },
  { value: 'min', labelKey: 'CLIMATIC.FUNC_MIN' },
  { value: 'count', labelKey: 'CLIMATIC.FUNC_COUNT' },
  { value: 'count_missing', labelKey: 'CLIMATIC.FUNC_COUNT_MISSING' },
];

/** Summary level display info */
export const SUMMARY_LEVELS: { value: SummaryLevel; labelKey: string }[] = [
  { value: 'annual', labelKey: 'CLIMATIC.LEVEL_ANNUAL' },
  { value: 'monthly', labelKey: 'CLIMATIC.LEVEL_MONTHLY' },
  { value: 'daily', labelKey: 'CLIMATIC.LEVEL_DAILY' },
  { value: 'station', labelKey: 'CLIMATIC.LEVEL_STATION' },
];
