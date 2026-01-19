import { inject, signal, OnInit, Output, EventEmitter, Directive } from '@angular/core';
import { RService } from '../../core/services/r.service';
import { ToastService } from '../../core/services/toast.service';
import { ColumnInfo } from '../../core/models/r.model';

/**
 * Base class for all statistical dialogs
 * 
 * Provides common functionality:
 * - Dataframe selection
 * - Column loading
 * - R code generation and execution
 * - Loading states
 * - Error handling
 */
@Directive()
export abstract class DialogBase implements OnInit {
  @Output() close = new EventEmitter<void>();

  protected readonly rService = inject(RService);
  protected readonly toastService = inject(ToastService);

  // Common state
  dataframes = signal<string[]>([]);
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  isLoading = signal(false);
  showCodePreview = signal(false);

  // Abstract properties that must be implemented
  abstract readonly dialogTitle: string;

  ngOnInit(): void {
    // Use Promise to handle async initialization without blocking
    this.loadDataframes().catch(error => {
      console.error('Failed to initialize dialog:', error);
      this.toastService.error('Failed to load data');
    });
  }

  /**
   * Load available dataframes
   */
  async loadDataframes(): Promise<void> {
    try {
      const dfs = this.rService.dataframes();
      this.dataframes.set(dfs);
      
      // Select active dataframe or first one
      const active = this.rService.activeDataframe();
      if (active && dfs.includes(active)) {
        this.selectedDataframe.set(active);
      } else if (dfs.length > 0) {
        this.selectedDataframe.set(dfs[0]);
      }

      // Load columns for selected dataframe
      if (this.selectedDataframe()) {
        await this.loadColumns();
      }
    } catch (error) {
      console.error('Failed to load dataframes:', error);
      throw error;
    }
  }

  /**
   * Load columns for the selected dataframe
   */
  async loadColumns(): Promise<void> {
    const df = this.selectedDataframe();
    console.log('[DialogBase] loadColumns called for:', df);
    if (!df) {
      this.columns.set([]);
      return;
    }

    try {
      const columnInfo = await this.rService.getColumnInfo(df);
      console.log('[DialogBase] Loaded columns:', columnInfo);
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
      
      // Check if R returned an error
      if (!result.success) {
        this.toastService.error(result.error || 'R command failed');
        return; // Don't close dialog on error
      }
      
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
   * Cancel and close dialog
   */
  cancel(): void {
    this.close.emit();
  }
}
