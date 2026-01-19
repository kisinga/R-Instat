/**
 * App State Models
 * 
 * Core state interfaces for the global app state service.
 * Kept minimal - only what's truly shared across the app.
 */

import { ColumnInfo } from './r.model';

/**
 * Data context - dataframes and their metadata
 */
export interface DataContextState {
  dataframes: string[];
  activeDataframe: string | null;
}

/**
 * Column selection state - persists user's column choices across dialogs
 */
export interface SelectionState {
  // Typed column selections for the active dataframe
  numericColumn: string | null;
  factorColumn: string | null;
  dateColumn: string | null;
  
  // Multi-column selections
  groupByColumns: string[];
  facetColumn: string | null;
}

/**
 * Graph preferences
 */
export interface GraphPreferences {
  fillColor: string;
  bins: number;
  showTrendLine: boolean;
}

/**
 * Summary preferences
 */
export interface SummaryPreferences {
  omitMissing: boolean;
  level: 'annual' | 'monthly' | 'daily';
}

/**
 * User preferences - last-used options that persist
 */
export interface PreferencesState {
  graph: GraphPreferences;
  summary: SummaryPreferences;
  // Dialog-specific defaults stored by dialog ID
  dialogDefaults: Record<string, Record<string, unknown>>;
}

/**
 * Default values
 */
export const DEFAULT_SELECTION_STATE: SelectionState = {
  numericColumn: null,
  factorColumn: null,
  dateColumn: null,
  groupByColumns: [],
  facetColumn: null,
};

export const DEFAULT_PREFERENCES: PreferencesState = {
  graph: {
    fillColor: '#6366f1',
    bins: 30,
    showTrendLine: false,
  },
  summary: {
    omitMissing: true,
    level: 'annual',
  },
  dialogDefaults: {},
};
