import { inject, signal, computed, OnInit, Output, EventEmitter, Directive } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';
import { RService } from '../../core/services/r.service';
import { ToastService } from '../../core/services/toast.service';
import { ColumnInfo } from '../../core/models/r.model';

/**
 * Base class for all statistical dialogs
 * 
 * Provides common functionality:
 * - Dataframe selection (from AppStateService - single source of truth)
 * - Column loading (with caching)
 * - R code generation and execution
 * - Dialog preference save/restore
 * - Loading states and error handling
 */
@Directive()
export abstract class DialogBase implements OnInit {
  @Output() close = new EventEmitter<void>();

  protected readonly appState = inject(AppStateService);
  protected readonly rService = inject(RService);
  protected readonly toastService = inject(ToastService);

  // Dataframes from global state (single source of truth)
  readonly dataframes = this.appState.dataframes;
  
  // Local dialog state
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  isLoading = signal(false);
  showCodePreview = signal(false);

  // Abstract properties
  abstract readonly dialogTitle: string;
  
  /**
   * Optional: Override to provide a unique ID for preference storage
   * Defaults to dialogTitle if not specified
   */
  get dialogId(): string {
    return this.dialogTitle.toLowerCase().replace(/\s+/g, '-');
  }

  ngOnInit(): void {
    this.initializeDialog().catch(error => {
      console.error('Failed to initialize dialog:', error);
      this.toastService.error('Failed to load data');
    });
  }

  /**
   * Initialize dialog with data and restore preferences
   */
  private async initializeDialog(): Promise<void> {
    const dfs = this.dataframes();
    
    // Select active dataframe or first one
    const active = this.appState.activeDataframe();
    if (active && dfs.includes(active)) {
      this.selectedDataframe.set(active);
    } else if (dfs.length > 0) {
      this.selectedDataframe.set(dfs[0]);
    }

    // Load columns for selected dataframe
    if (this.selectedDataframe()) {
      await this.loadColumns();
    }

    // Restore saved preferences
    this.restoreDefaults();
  }

  /**
   * Load columns for the selected dataframe (uses cache)
   */
  async loadColumns(): Promise<void> {
    const df = this.selectedDataframe();
    if (!df) {
      this.columns.set([]);
      return;
    }

    try {
      const columnInfo = await this.rService.getColumnInfo(df);
      this.columns.set(columnInfo);
    } catch (error) {
      console.error('Failed to load columns:', error);
      this.columns.set([]);
    }
  }

  /**
   * Handle dataframe selection change
   */
  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    await this.loadColumns();
    this.onDataframeChanged();
  }

  /**
   * Hook for subclasses to handle dataframe changes
   */
  protected onDataframeChanged(): void {
    // Override in subclass if needed
  }

  /**
   * Build R code - must be implemented by subclasses
   */
  abstract buildRCode(): string;

  /**
   * Check if the dialog form is valid
   */
  abstract isValid(): boolean;

  /**
   * Execute the R code
   */
  async execute(): Promise<void> {
    if (!this.isValid()) {
      this.toastService.warning('Please fill in all required fields');
      return;
    }

    const code = this.buildRCode();
    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(code);
      
      if (!result.success) {
        this.toastService.error(result.error || 'R command failed');
        return;
      }
      
      // Save preferences on successful execution
      this.saveDefaults();
      
      this.toastService.success('Command executed successfully');
      this.close.emit();
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Failed to execute command'
      );
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Toggle code preview
   */
  toggleCodePreview(): void {
    this.showCodePreview.update(v => !v);
  }

  /**
   * Get columns filtered by type
   */
  getColumnsByType(types: string[]): ColumnInfo[] {
    return this.columns().filter(col => {
      const colType = col.type.toLowerCase();
      return types.some(t => colType.includes(t.toLowerCase()));
    });
  }

  /**
   * Get numeric columns
   */
  getNumericColumns(): ColumnInfo[] {
    return this.getColumnsByType(['numeric', 'integer', 'double']);
  }

  /**
   * Get factor/character columns
   */
  getFactorColumns(): ColumnInfo[] {
    return this.getColumnsByType(['factor', 'character']);
  }

  /**
   * Get date columns
   */
  getDateColumns(): ColumnInfo[] {
    return this.getColumnsByType(['date', 'posix']);
  }

  /**
   * Cancel and close dialog
   */
  cancel(): void {
    this.close.emit();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCE SAVE/RESTORE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Override to return current dialog settings for persistence
   */
  protected getCurrentDefaults(): Record<string, unknown> {
    return {};
  }

  /**
   * Override to apply restored defaults to dialog fields
   */
  protected applyDefaults(_defaults: Record<string, unknown>): void {
    // Override in subclass
  }

  /**
   * Save current settings to preferences
   */
  protected saveDefaults(): void {
    const defaults = this.getCurrentDefaults();
    if (Object.keys(defaults).length > 0) {
      this.appState.saveDialogDefaults(this.dialogId, defaults);
    }
  }

  /**
   * Restore saved settings from preferences
   */
  protected restoreDefaults(): void {
    const defaults = this.appState.getDialogDefaults(this.dialogId);
    if (defaults) {
      this.applyDefaults(defaults);
    }
  }
}
