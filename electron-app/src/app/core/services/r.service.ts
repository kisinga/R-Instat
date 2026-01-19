import { Injectable, NgZone, signal, computed, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RResult, DataPreview, ColumnInfo, OutputEntry, RHealthStatus } from '../models/r.model';
import { AppStateService } from './app-state.service';

/**
 * R Service - R backend communication
 * 
 * This service handles:
 * - R code execution via Electron IPC
 * - R health status and package management
 * - Output history tracking
 * - Data fetching (preview, columns)
 * 
 * State is delegated to AppStateService (single source of truth).
 */
@Injectable({ providedIn: 'root' })
export class RService implements OnDestroy {
  private readonly appState = inject(AppStateService);

  // Connection state
  private readonly _isConnected = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _healthStatus = signal<RHealthStatus>({ status: 'starting' });

  readonly isConnected = this._isConnected.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly healthStatus = this._healthStatus.asReadonly();
  readonly isReady = computed(() => this._healthStatus().status === 'ready');

  // Delegate to AppStateService - expose for backward compatibility
  readonly dataframes = this.appState.dataframes;
  readonly activeDataframe = this.appState.activeDataframe;
  readonly onDataRefresh$ = this.appState.onDataRefresh$;
  readonly dialog$ = this.appState.dialog$;

  // Output history
  private readonly outputHistory$ = new BehaviorSubject<OutputEntry[]>([]);
  readonly output$: Observable<OutputEntry[]> = this.outputHistory$.asObservable();

  private cleanupStatusListener?: () => void;

  constructor(private ngZone: NgZone) {
    this.initializeHealthCheck();
  }

  ngOnDestroy(): void {
    this.cleanupStatusListener?.();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE DELEGATION (for backward compatibility)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set active dataframe - delegates to AppStateService
   */
  setActiveDataframe(name: string): void {
    this.appState.setActiveDataframe(name);
  }

  /**
   * Open a dialog - delegates to AppStateService
   */
  openDialog(dialogName: string): void {
    this.appState.openDialog(dialogName);
  }

  /**
   * Close a dialog - delegates to AppStateService
   */
  closeDialog(dialogName: string): void {
    this.appState.closeDialog(dialogName);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH & CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════

  private async initializeHealthCheck(): Promise<void> {
    if (!window.electronAPI) {
      this._healthStatus.set({ status: 'error', error: 'Electron API not available' });
      return;
    }

    this.cleanupStatusListener = window.electronAPI.r.onStatusChange((status) => {
      this.ngZone.run(() => {
        this._healthStatus.set(status);
        this._isConnected.set(status.status === 'ready');
      });
    });

    try {
      const status = await window.electronAPI.r.status();
      this.ngZone.run(() => {
        this._healthStatus.set(status);
        this._isConnected.set(status.status === 'ready');
      });
    } catch {
      this._healthStatus.set({ status: 'error', error: 'Failed to get R status' });
      this._isConnected.set(false);
    }
  }

  async checkConnection(): Promise<void> {
    try {
      if (window.electronAPI) {
        const status = await window.electronAPI.r.status();
        this.ngZone.run(() => {
          this._healthStatus.set(status);
          this._isConnected.set(status.status === 'ready');
        });
      }
    } catch {
      this._isConnected.set(false);
      this._healthStatus.set({ status: 'error', error: 'Failed to connect to R' });
    }
  }

  async getStatus(): Promise<RHealthStatus> {
    if (!window.electronAPI) {
      return { status: 'error', error: 'Electron API not available' };
    }
    return window.electronAPI.r.status();
  }

  async installPackages(packages?: string[]): Promise<RResult> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.r.installPackages(packages);
  }

  async restartR(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.r.restart();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // R EXECUTION
  // ═══════════════════════════════════════════════════════════════════════════

  async execute(code: string, silent = false): Promise<RResult> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    this._isLoading.set(true);
    const startTime = Date.now();

    try {
      const result = await window.electronAPI.r.execute(code);
      const duration = Date.now() - startTime;

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

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Refresh dataframes from R and update AppStateService
   */
  async refreshDataframes(): Promise<void> {
    if (!window.electronAPI) return;

    try {
      const names = await window.electronAPI.r.getDataframes();
      // Invalidate column cache when dataframes change
      this.appState.invalidateColumnCache();
      this.appState.updateDataframes(names);
    } catch (error) {
      console.error('Failed to refresh dataframes:', error);
    }
  }

  async getDataPreview(name: string, limit = 100, offset = 0): Promise<DataPreview> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }
    return window.electronAPI.r.getDataPreview(name, limit, offset);
  }

  async getColumns(dataframe: string): Promise<string[]> {
    if (!window.electronAPI) {
      return [];
    }
    return window.electronAPI.r.getColumns(dataframe);
  }

  /**
   * Get column info - uses AppStateService cache
   */
  async getColumnInfo(dataframe: string): Promise<ColumnInfo[]> {
    return this.appState.getColumnInfo(dataframe, async () => {
      if (!window.electronAPI) {
        return [];
      }
      const [columns, types] = await Promise.all([
        window.electronAPI.r.getColumns(dataframe),
        window.electronAPI.r.getColumnTypes(dataframe),
      ]);
      return columns.map(name => ({
        name,
        type: types[name] || 'unknown',
      }));
    });
  }

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

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT HISTORY
  // ═══════════════════════════════════════════════════════════════════════════

  clearHistory(): void {
    this.outputHistory$.next([]);
  }

  private addToHistory(entry: OutputEntry): void {
    this.ngZone.run(() => {
      const current = this.outputHistory$.value;
      this.outputHistory$.next([entry, ...current].slice(0, 100));
    });
  }

  private mightChangeData(code: string): boolean {
    const patterns = [
      '<-', 'read.', 'import', 'load', 'mutate', 'filter',
      'select', 'rename', 'delete', 'add_', 'remove_', 'data_book',
    ];
    const lower = code.toLowerCase();
    return patterns.some(p => lower.includes(p.toLowerCase()));
  }
}
