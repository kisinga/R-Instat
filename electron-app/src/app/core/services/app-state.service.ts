/**
 * App State Service
 * 
 * Single source of truth for app-wide state:
 * - Data context (dataframes, active dataframe)
 * - Column metadata (cached)
 * - User selections (persists across dialogs)
 * - Preferences (graph settings, dialog defaults)
 */

import { Injectable, signal, computed, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { ColumnInfo } from '../models/r.model';
import {
  SelectionState,
  PreferencesState,
  DEFAULT_SELECTION_STATE,
  DEFAULT_PREFERENCES,
} from '../models/app-state.model';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA CONTEXT
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly _dataframes = signal<string[]>([]);
  private readonly _activeDataframe = signal<string | null>(null);
  
  readonly dataframes = this._dataframes.asReadonly();
  readonly activeDataframe = this._activeDataframe.asReadonly();
  
  readonly hasData = computed(() => this._dataframes().length > 0);

  // Data refresh trigger - emits when data might have changed
  private readonly _dataRefresh$ = new Subject<void>();
  readonly onDataRefresh$ = this._dataRefresh$.asObservable();

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN METADATA CACHE
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly columnCache = new Map<string, ColumnInfo[]>();

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly _selections = signal<SelectionState>({ ...DEFAULT_SELECTION_STATE });
  readonly selections = this._selections.asReadonly();

  // Convenience accessors
  readonly selectedNumericColumn = computed(() => this._selections().numericColumn);
  readonly selectedFactorColumn = computed(() => this._selections().factorColumn);
  readonly selectedDateColumn = computed(() => this._selections().dateColumn);
  readonly groupByColumns = computed(() => this._selections().groupByColumns);
  readonly facetColumn = computed(() => this._selections().facetColumn);

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly _preferences = signal<PreferencesState>({ 
    ...DEFAULT_PREFERENCES,
    includeCodeMetadata: DEFAULT_PREFERENCES.includeCodeMetadata ?? true 
  });
  readonly preferences = this._preferences.asReadonly();

  readonly graphPreferences = computed(() => this._preferences().graph);
  readonly summaryPreferences = computed(() => this._preferences().summary);
  readonly includeCodeMetadata = computed(() => this._preferences().includeCodeMetadata ?? true);

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG COORDINATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  private readonly _dialog$ = new Subject<{ action: 'open' | 'close'; dialog: string }>();
  readonly dialog$ = this._dialog$.asObservable();

  constructor(private ngZone: NgZone) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA CONTEXT ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update the list of available dataframes
   */
  updateDataframes(names: string[]): void {
    this.ngZone.run(() => {
      this._dataframes.set(names);
      
      // If active dataframe is gone, select first available
      const active = this._activeDataframe();
      if (!active || !names.includes(active)) {
        this._activeDataframe.set(names[0] || null);
        // Clear selections when dataframe changes
        this.clearSelections();
      }
      
      // Invalidate cache for removed dataframes
      for (const cached of this.columnCache.keys()) {
        if (!names.includes(cached)) {
          this.columnCache.delete(cached);
        }
      }
    });
    
    this._dataRefresh$.next();
  }

  /**
   * Set the active dataframe
   */
  setActiveDataframe(name: string): void {
    if (this._dataframes().includes(name) && this._activeDataframe() !== name) {
      this._activeDataframe.set(name);
      // Clear selections when switching dataframes
      this.clearSelections();
      this._dataRefresh$.next();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN METADATA
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get column info, using cache when available
   * Must provide fetcher since we don't want to depend on RService here
   */
  async getColumnInfo(
    dataframe: string,
    fetcher: () => Promise<ColumnInfo[]>
  ): Promise<ColumnInfo[]> {
    const cached = this.columnCache.get(dataframe);
    if (cached) {
      return cached;
    }

    const columns = await fetcher();
    this.columnCache.set(dataframe, columns);
    return columns;
  }

  /**
   * Invalidate column cache (call after data mutations)
   */
  invalidateColumnCache(dataframe?: string): void {
    if (dataframe) {
      this.columnCache.delete(dataframe);
    } else {
      this.columnCache.clear();
    }
  }

  /**
   * Get cached columns if available (synchronous)
   */
  getCachedColumns(dataframe: string): ColumnInfo[] | null {
    return this.columnCache.get(dataframe) ?? null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SELECTION ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set a typed column selection
   */
  setColumnSelection(type: 'numeric' | 'factor' | 'date', column: string | null): void {
    const key = `${type}Column` as keyof SelectionState;
    this._selections.update(s => ({ ...s, [key]: column }));
  }

  /**
   * Set grouping columns
   */
  setGroupByColumns(columns: string[]): void {
    this._selections.update(s => ({ ...s, groupByColumns: columns }));
  }

  /**
   * Set facet column
   */
  setFacetColumn(column: string | null): void {
    this._selections.update(s => ({ ...s, facetColumn: column }));
  }

  /**
   * Clear all selections
   */
  clearSelections(): void {
    this._selections.set({ ...DEFAULT_SELECTION_STATE });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCE ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Update graph preferences
   */
  updateGraphPreferences(updates: Partial<PreferencesState['graph']>): void {
    this._preferences.update(p => ({
      ...p,
      graph: { ...p.graph, ...updates },
    }));
  }

  /**
   * Update summary preferences
   */
  updateSummaryPreferences(updates: Partial<PreferencesState['summary']>): void {
    this._preferences.update(p => ({
      ...p,
      summary: { ...p.summary, ...updates },
    }));
  }

  /**
   * Save dialog-specific defaults
   */
  saveDialogDefaults(dialogId: string, defaults: Record<string, unknown>): void {
    this._preferences.update(p => ({
      ...p,
      dialogDefaults: { ...p.dialogDefaults, [dialogId]: defaults },
    }));
  }

  /**
   * Get dialog-specific defaults
   */
  getDialogDefaults<T extends Record<string, unknown>>(dialogId: string): T | null {
    return (this._preferences().dialogDefaults[dialogId] as T) ?? null;
  }

  /**
   * Set include code metadata feature flag
   */
  setIncludeCodeMetadata(value: boolean): void {
    this._preferences.update(p => ({
      ...p,
      includeCodeMetadata: value,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DIALOG COORDINATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Open a dialog
   */
  openDialog(dialogName: string): void {
    this._dialog$.next({ action: 'open', dialog: dialogName });
  }

  /**
   * Close a dialog
   */
  closeDialog(dialogName: string): void {
    this._dialog$.next({ action: 'close', dialog: dialogName });
  }
}
