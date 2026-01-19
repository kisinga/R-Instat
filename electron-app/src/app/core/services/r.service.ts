import { Injectable, NgZone, signal, computed } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { RResult, DataPreview, ColumnInfo, OutputEntry } from '../models/r.model';

/**
 * R Service - Central service for all R backend communication
 * 
 * This service:
 * - Communicates with R via Electron IPC
 * - Manages dataframe state
 * - Tracks command history for output panel
 * - Provides dialog open/close coordination
 */
@Injectable({ providedIn: 'root' })
export class RService {
  // State signals
  private readonly _dataframes = signal<string[]>([]);
  private readonly _activeDataframe = signal<string | null>(null);
  private readonly _isConnected = signal(false);
  private readonly _isLoading = signal(false);

  // Public readonly signals
  readonly dataframes = this._dataframes.asReadonly();
  readonly activeDataframe = this._activeDataframe.asReadonly();
  readonly isConnected = this._isConnected.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // Output history
  private readonly outputHistory$ = new BehaviorSubject<OutputEntry[]>([]);
  readonly output$: Observable<OutputEntry[]> = this.outputHistory$.asObservable();

  // Dialog coordination
  private readonly dialogSubject = new Subject<{ action: 'open' | 'close'; dialog: string }>();
  readonly dialog$ = this.dialogSubject.asObservable();

  // Data refresh trigger
  private readonly dataRefresh$ = new Subject<void>();
  readonly onDataRefresh$ = this.dataRefresh$.asObservable();

  constructor(private ngZone: NgZone) {
    // Initial connection check
    this.checkConnection();
  }

  /**
   * Check R connection status
   */
  async checkConnection(): Promise<void> {
    try {
      if (window.electronAPI) {
        const status = await window.electronAPI.r.status();
        this.ngZone.run(() => {
          this._isConnected.set(status.connected);
        });
      }
    } catch {
      this._isConnected.set(false);
    }
  }

  /**
   * Get R connection status
   */
  async getStatus(): Promise<{ connected: boolean }> {
    if (!window.electronAPI) {
      return { connected: false };
    }
    return window.electronAPI.r.status();
  }

  /**
   * Execute R code and return result
   */
  async execute(code: string, silent = false): Promise<RResult> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    this._isLoading.set(true);
    const startTime = Date.now();

    try {
      const result = await window.electronAPI.r.execute(code);
      const duration = Date.now() - startTime;

      // Add to output history unless silent
      if (!silent) {
        this.addToHistory({
          id: crypto.randomUUID(),
          code,
          result,
          timestamp: new Date(),
          duration,
        });
      }

      // Refresh dataframes if data might have changed
      if (this.mightChangeData(code)) {
        await this.refreshDataframes();
      }

      return result;
    } catch (error) {
      const errorResult: RResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      if (!silent) {
        this.addToHistory({
          id: crypto.randomUUID(),
          code,
          result: errorResult,
          timestamp: new Date(),
          duration: Date.now() - startTime,
        });
      }

      throw error;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Load available dataframes from R
   */
  async refreshDataframes(): Promise<void> {
    if (!window.electronAPI) return;

    try {
      const names = await window.electronAPI.r.getDataframes();
      this.ngZone.run(() => {
        this._dataframes.set(names);
        
        // Set active dataframe if not set or current one no longer exists
        const active = this._activeDataframe();
        if (!active || !names.includes(active)) {
          this._activeDataframe.set(names[0] || null);
        }
      });
      
      this.dataRefresh$.next();
    } catch (error) {
      console.error('Failed to refresh dataframes:', error);
    }
  }

  /**
   * Get data preview for a dataframe
   */
  async getDataPreview(name: string, limit = 100, offset = 0): Promise<DataPreview> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.r.getDataPreview(name, limit, offset);
  }

  /**
   * Get column names for a dataframe
   */
  async getColumns(dataframe: string): Promise<string[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.r.getColumns(dataframe);
  }

  /**
   * Get column info with types
   */
  async getColumnInfo(dataframe: string): Promise<ColumnInfo[]> {
    if (!window.electronAPI) {
      console.warn('[RService] getColumnInfo: electronAPI not available');
      return [];
    }

    console.log('[RService] getColumnInfo for:', dataframe);
    const [columns, types] = await Promise.all([
      window.electronAPI.r.getColumns(dataframe),
      window.electronAPI.r.getColumnTypes(dataframe),
    ]);
    console.log('[RService] columns:', columns);
    console.log('[RService] types:', types);

    const result = columns.map(name => ({
      name,
      type: types[name] || 'unknown',
    }));
    console.log('[RService] columnInfo result:', result);
    return result;
  }

  /**
   * Load demo data
   */
  async loadDemoData(): Promise<RResult> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    this._isLoading.set(true);
    try {
      const result = await window.electronAPI.r.loadDemoData();
      await this.refreshDataframes();
      
      this.addToHistory({
        id: crypto.randomUUID(),
        code: '# Loaded World Bank Tanzania demo dataset',
        result,
        timestamp: new Date(),
        duration: 0,
      });

      return result;
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Set active dataframe
   */
  setActiveDataframe(name: string): void {
    if (this._dataframes().includes(name)) {
      this._activeDataframe.set(name);
    }
  }

  /**
   * Open a dialog
   */
  openDialog(dialogName: string): void {
    this.dialogSubject.next({ action: 'open', dialog: dialogName });
  }

  /**
   * Close current dialog
   */
  closeDialog(dialogName: string): void {
    this.dialogSubject.next({ action: 'close', dialog: dialogName });
  }

  /**
   * Clear output history
   */
  clearHistory(): void {
    this.outputHistory$.next([]);
  }

  /**
   * Add entry to output history
   */
  private addToHistory(entry: OutputEntry): void {
    // Use ngZone to ensure Angular detects the change
    this.ngZone.run(() => {
      const current = this.outputHistory$.value;
      this.outputHistory$.next([entry, ...current].slice(0, 100)); // Keep last 100 entries
    });
  }

  /**
   * Check if R code might change data (trigger refresh)
   */
  private mightChangeData(code: string): boolean {
    const dataChangingPatterns = [
      '<-',
      'read.',
      'import',
      'load',
      'mutate',
      'filter',
      'select',
      'rename',
      'delete',
      'add_',
      'remove_',
      'data_book',
    ];
    
    const lowerCode = code.toLowerCase();
    return dataChangingPatterns.some(pattern => lowerCode.includes(pattern.toLowerCase()));
  }
}
