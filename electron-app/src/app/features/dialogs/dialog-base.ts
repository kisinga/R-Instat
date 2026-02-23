import { inject, signal, computed, OnInit, AfterViewInit, Output, EventEmitter, Directive, Injector, runInInjectionContext, effect, WritableSignal } from '@angular/core';
import { AppStateService } from '../../core/services/app-state.service';
import { RService } from '../../core/services/r.service';
import { ToastService } from '../../core/services/toast.service';
import { ColumnInfo } from '../../core/models/r.model';
import { DialogRCodeManager } from '../../core/dialogs/dialog-r-code-manager.service';
import { RSyntax } from '../../core/r-codegen/syntax';
import { DialogBuilder } from '../../core/dialogs/builders/types';
import { DialogMetadata } from '../../core/r-codegen/dialog-metadata';
import { stripMetadata } from '../../core/r-codegen/metadata-parser';
import { DialogRestoreService } from '../../core/services/dialog-restore.service';
import { getMetadataStateDiagnostics } from '../../core/ai/dialog-metadata-contract';
import { getDialogId } from '../../core/ai/dialog-identity.registry';

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
export abstract class DialogBase implements OnInit, AfterViewInit {
  @Output() close = new EventEmitter<void>();

  protected readonly appState = inject(AppStateService);
  protected readonly rService = inject(RService);
  protected readonly toastService = inject(ToastService);
  protected readonly codeManager = inject(DialogRCodeManager);
  protected readonly injector = inject(Injector);
  protected readonly dialogRestoreService = inject(DialogRestoreService);

  // Dataframes from global state (single source of truth)
  readonly dataframes = this.appState.dataframes;
  
  // Local dialog state
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  isLoading = signal(false);
  showCodePreview = signal(false);

  /**
   * Computed signal for form validity state
   * Exposes the abstract isValid() method as a signal for use in templates
   */
  readonly formValid = computed(() => this.isValid());

  // Form field registry for automatic save/restore/auto-population
  private formFields = new Map<string, WritableSignal<any>>();
  private autoPopulateSources: Array<() => Record<string, any> | null> = [];

  // Abstract properties
  abstract readonly dialogTitle: string;
  
  /**
   * Deterministic dialog identity used for preference persistence and metadata.
   * Dialogs can provide static dialogId; otherwise identity is resolved from
   * the shared dialog identity registry using component type.
   */
  get dialogId(): string {
    const ctor = this.constructor as typeof DialogBase & { dialogId?: string };
    if (typeof ctor.dialogId === 'string' && ctor.dialogId.length > 0) {
      return ctor.dialogId;
    }
    const byComponentName = getDialogId(this.constructor.name);
    if (byComponentName) {
      return byComponentName;
    }
    throw new Error(`Dialog "${this.constructor.name}" is missing identity registration`);
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

    // Restore saved preferences (uses registry if available, otherwise fallback to override)
    this.restoreDefaults();
    
    // Auto-populate from registered sources (after restore, so roles override preferences)
    this.autoPopulateFromSources();

    // Restoration will happen in ngAfterViewInit after child component has registered form fields
  }

  /**
   * Called after view initialization - ensures child component's ngOnInit has completed
   * This is where we check for restoration data, after form fields are registered
   */
  ngAfterViewInit(): void {
    // Check for restoration data from restore-from-code dialog
    // This runs after child component's ngOnInit, so form fields should be registered
    setTimeout(async () => {
      const restoreData = this.dialogRestoreService.getRestoreData();
      if (restoreData && restoreData.dialogId === this.dialogId) {
        const success = await this.restoreFromMetadata(restoreData);
        if (success) {
          this.dialogRestoreService.clearRestoreData();
          console.log('[DialogBase] State restored successfully');
        } else {
          console.warn('[DialogBase] Failed to restore state');
        }
      }
    }, 0);
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
    // Auto-populate after dataframe change (e.g., for climatic roles)
    this.autoPopulateFromSources();
  }

  /**
   * Hook for subclasses to handle dataframe changes
   */
  protected onDataframeChanged(): void {
    // Override in subclass if needed
  }

  /**
   * Build R code - can be overridden by subclasses
   * 
   * Default implementation uses codeManager if initialized, otherwise returns empty string.
   * Subclasses can override this if they need custom logic or aren't using codeManager.
   */
  buildRCode(): string {
    // Use code manager if initialized (new pattern)
    if (this.codeManager.getSyntax() !== null) {
      return this.codeManager.code();
    }
    // Fallback for dialogs not yet migrated to codeManager
    return '';
  }

  /**
   * Check if the dialog form is valid
   */
  abstract isValid(): boolean;

  /**
   * Execute the R code
   * 
   * Uses code manager if initialized, otherwise falls back to buildRCode()
   */
  async execute(): Promise<void> {
    if (!this.isValid()) {
      this.toastService.warning('Please fill in all required fields');
      return;
    }

    this.isLoading.set(true);

    try {
      // Use code manager if available, otherwise use buildRCode()
      const result = this.codeManager.getSyntax()
        ? await this.codeManager.execute(this.rService)
        : await this.rService.execute(this.buildRCode());
      
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
  // FORM FIELD REGISTRY & AUTO-POPULATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Register form fields for automatic save/restore/auto-population.
   * Once registered, fields are automatically saved on execute() and restored on init.
   * 
   * @param fields - Object mapping field names to their signal instances
   * 
   * @example
   * this.registerFormFields({
   *   dateColumn: this.dateColumn,
   *   elementColumn: this.elementColumn,
   *   stationColumn: this.stationColumn,
   * });
   */
  protected registerFormFields(fields: Record<string, WritableSignal<any>>): void {
    for (const [name, signal] of Object.entries(fields)) {
      this.formFields.set(name, signal);
    }
  }

  /**
   * Register an auto-population source that provides values for form fields.
   * Sources are called after restoreDefaults() and on dataframe changes.
   * Multiple sources can be registered; they are applied in registration order.
   * 
   * @param source - Function that returns field values or null
   * 
   * @example
   * this.registerAutoPopulateSource(() => {
   *   const df = this.selectedDataframe();
   *   if (!df) return null;
   *   const roles = this.climaticService.getRoles(df);
   *   return {
   *     dateColumn: roles.date,
   *     elementColumn: roles.rain,
   *   };
   * });
   */
  protected registerAutoPopulateSource(
    source: () => Record<string, any> | null
  ): void {
    this.autoPopulateSources.push(source);
  }

  /**
   * Get current form state from registered fields
   */
  private getFormState(): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (const [name, signal] of this.formFields) {
      const value = signal();
      state[name] = value;
    }
    return state;
  }

  /**
   * Apply form state to registered fields
   */
  private applyFormState(state: Record<string, unknown>): void {
    for (const [name, value] of Object.entries(state)) {
      const signal = this.formFields.get(name);
      if (signal && value !== undefined) {
        signal.set(value);
      }
    }
  }

  /**
   * Auto-populate fields from all registered sources
   */
  private autoPopulateFromSources(): void {
    for (const source of this.autoPopulateSources) {
      const values = source();
      if (values) {
        this.applyFormState(values);
      }
    }
  }

  /**
   * Get dialog metadata for embedding in R code
   * Returns null if feature flag is disabled or no form fields are registered
   */
  protected getDialogMetadata(): DialogMetadata | null {
    // Check feature flag
    const featureEnabled = this.appState.includeCodeMetadata();
    if (!featureEnabled) {
      console.log('[DialogBase] Metadata disabled by feature flag');
      return null;
    }

    // Only generate metadata when form is valid
    if (!this.isValid()) {
      console.log('[DialogBase] Form is invalid, skipping metadata generation');
      return null;
    }

    // Always include dataframe in state if available (even without form fields)
    const df = this.selectedDataframe();
    const state: Record<string, any> = {};
    
    if (df) {
      state['dataframe'] = df;
    }
    
    // Add form field state if registered
    if (this.formFields.size > 0) {
      const formState = this.getFormState();
      console.log('[DialogBase] Form state from registry:', formState, 'Form fields count:', this.formFields.size);
      // Include all non-null/undefined values in metadata
      // For strings, include them even if empty (empty might mean "none selected" for optional fields)
      // But we'll include them so restoration can distinguish between "not set" and "explicitly empty"
      for (const [key, value] of Object.entries(formState)) {
        if (value !== null && value !== undefined) {
          state[key] = value;
        }
      }
    } else {
      console.log('[DialogBase] No form fields registered');
    }
    
    // Generate metadata if we have at least a dataframe
    if (!df && Object.keys(state).length === 0) {
      console.log('[DialogBase] No dataframe and no form state');
      return null;
    }

    // Get component type from constructor name
    const componentType = this.constructor.name;

    const metadata: DialogMetadata = {
      dialogId: this.dialogId,
      componentType,
      version: '1.0',
      state,
      timestamp: new Date().toISOString(),
    };
    
    console.log('[DialogBase] Generated metadata:', metadata);
    return metadata;
  }

  /**
   * Get code for display (metadata stripped for readability)
   */
  protected getCodeForDisplay(): string {
    const code = this.codeManager.code();
    if (!code) return '';
    return stripMetadata(code);
  }

  /**
   * Get code for copying (always includes metadata if present)
   */
  protected getCodeForCopy(): string {
    return this.codeManager.code();
  }

  /**
   * Restore dialog state from metadata
   * 
   * Called automatically if restoration data is found in DialogRestoreService.
   * Sets dataframe, loads columns, and applies state using form field registry.
   */
  protected async restoreFromMetadata(metadata: DialogMetadata): Promise<boolean> {
    try {
      // Validate dialog ID matches
      if (metadata.dialogId !== this.dialogId) {
        console.warn(`Dialog ID mismatch: expected ${this.dialogId}, got ${metadata.dialogId}`);
        return false;
      }

      const diagnostics = getMetadataStateDiagnostics(
        this.dialogId,
        metadata.state ?? {},
        this.formFields.keys()
      );
      if (diagnostics.unknownKeys.length > 0) {
        console.warn(
          `[DialogBase] Metadata contains keys not in schema for "${this.dialogId}": ${diagnostics.unknownKeys.join(', ')}`
        );
      }
      if (diagnostics.unregisteredKeys.length > 0) {
        console.warn(
          `[DialogBase] Metadata keys are valid schema params but not registered form fields for "${this.dialogId}": ${diagnostics.unregisteredKeys.join(', ')}`
        );
      }

      // Set dataframe if provided and exists
      if (metadata.state['dataframe']) {
        const dataframes = this.dataframes();
        if (dataframes.includes(metadata.state['dataframe'] as string)) {
          this.selectedDataframe.set(metadata.state['dataframe'] as string);
          await this.loadColumns();
        } else {
          console.warn(`Dataframe "${metadata.state['dataframe']}" not found`);
          // Continue with restoration anyway - user might have different dataframe names
        }
      }

      // Apply state using form field registry
      if (this.formFields.size > 0) {
        this.applyFormState(metadata.state);
      } else {
        // Fallback for dialogs without registry
        this.applyDefaults(metadata.state);
      }

      return true;
    } catch (error) {
      console.error('Failed to restore from metadata:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREFERENCE SAVE/RESTORE (Backward Compatible)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Override to return current dialog settings for persistence.
   * If form fields are registered, this is automatically handled.
   * Override only if you need custom behavior beyond the registry.
   */
  protected getCurrentDefaults(): Record<string, unknown> {
    // Use registry if available, otherwise return empty (backward compatible)
    if (this.formFields.size > 0) {
      return this.getFormState();
    }
    return {};
  }

  /**
   * Override to apply restored defaults to dialog fields.
   * If form fields are registered, this is automatically handled.
   * Override only if you need custom behavior beyond the registry.
   */
  protected applyDefaults(defaults: Record<string, unknown>): void {
    // Use registry if available, otherwise do nothing (backward compatible)
    if (this.formFields.size > 0) {
      this.applyFormState(defaults);
    }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // R CODE MANAGER INTEGRATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Initialize the R code manager with a builder function
   *
   * This helper method sets up reactive R code generation. The builder function
   * should return an RSyntax instance based on current dialog state.
   *
   * The code manager will automatically rebuild whenever rebuild() is called,
   * and provides a computed `code` signal that components can use.
   *
   * Metadata is automatically attached if feature flag is enabled and form fields are registered.
   *
   * @param builder - DialogBuilder function that builds RSyntax from dialog state
   * @param skipInitialRebuild - If true, skip initial rebuild (effect will handle it)
   *
   * @example
   * ngOnInit(): void {
   *   this.initializeCodeManager(() =>
   *     buildBarChart({
   *       dataframe: this.selectedDataframe(),
   *       xVariable: this.xVariable(),
   *     })
   *   );
   * }
   */
  protected initializeCodeManager(builder: DialogBuilder, skipInitialRebuild: boolean = false): void {
    this.codeManager.initialize(() => {
      const syntax = builder();
      const metadata = this.getDialogMetadata();
      if (metadata) {
        return syntax.setMetadata(metadata);
      } else {
        return syntax;
      }
    }, skipInitialRebuild);
  }

  /**
   * Get the current R code as a computed signal
   *
   * This provides reactive access to the generated R code string.
   * The code updates automatically whenever the code manager rebuilds.
   *
   * @returns Computed signal containing the R code string
   */
  protected getRCode(): string {
    return this.codeManager.code();
  }

  /**
   * Computed signal for reactive R code access
   * 
   * Subclasses can use this in templates: {{ rCode() }}
   * Automatically updates when codeManager rebuilds.
   */
  readonly rCode = computed(() => this.codeManager.code());

  /**
   * Rebuild R code from current dialog state
   *
   * Call this whenever dialog state changes that affect R code generation.
   */
  protected rebuildRCode(): void {
    this.codeManager.rebuild();
  }

  /**
   * Create effect in proper injection context (required for ngOnInit)
   */
  protected createEffect(effectFn: () => void): void {
    runInInjectionContext(this.injector, () => effect(effectFn));
  }
}
