/**
 * Describe Dialog Component
 * 
 * Unified dialog for describing data through summaries, graphs, and frequencies.
 * Adapts available options based on selected variable types.
 */

import { Component, signal, computed, inject, OnInit, OnDestroy, Output, EventEmitter, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { ColumnInfo } from '../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { DescribeDialogService, OutputMode } from './describe-dialog.service';
import { GraphMode } from './utils/variable-type-analyzer';
import { GraphPanelComponent } from './panels/graph-panel.component';
import { FrequencyPanelComponent } from './panels/frequency-panel.component';

@Component({
  selector: 'app-describe-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ColumnPickerComponent,
    GraphPanelComponent,
    FrequencyPanelComponent,
  ],
  providers: [DescribeDialogService],
  template: `
    <div class="dialog-content describe-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'DESCRIBE.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <!-- Left Column: Data Selection -->
        <div class="data-selection">
          <!-- Graph Mode Selector -->
          @if (service.outputMode() === 'graph') {
            <div class="form-group">
              <label class="form-label">{{ 'DESCRIBE.GRAPH_MODE' | translate }}</label>
              <select 
                class="select select-bordered w-full select-sm"
                [ngModel]="service.graphMode()"
                (ngModelChange)="setGraphMode($event)"
              >
                <option value="distribution">{{ 'DESCRIBE.MODE_DISTRIBUTION' | translate }}</option>
                <option value="comparison">{{ 'DESCRIBE.MODE_COMPARISON' | translate }}</option>
                <option value="faceted">{{ 'DESCRIBE.MODE_FACETED' | translate }}</option>
              </select>
              <p class="text-xs text-base-content/60 mt-1">{{ service.modeConfig().hint }}</p>
            </div>
          }

          <!-- Dataframe Selection -->
          <div class="form-group">
            <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
            @if (dataframes().length === 0) {
              <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
                {{ 'DIALOG.NO_DATA' | translate }}
              </div>
            } @else {
              <select 
                class="select select-bordered w-full select-sm"
                [ngModel]="service.dataframe()"
                (ngModelChange)="onDataframeChange($event)"
              >
                @for (df of dataframes(); track df) {
                  <option [value]="df">{{ df }}</option>
                }
              </select>
            }
          </div>

          <!-- Analyze Variables (Primary) -->
          <div class="form-group">
            <div class="flex items-center gap-2">
              <label class="form-label">
                {{ getAnalyzeLabel() | translate }}
              </label>
              <span 
                class="tooltip tooltip-right cursor-help" 
                [attr.data-tip]="'DESCRIBE.ANALYZE_TOOLTIP' | translate"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              @if (allowMultipleAnalyze()) {
                <span class="text-xs text-base-content/60 ml-auto">({{ analyzeVarNames.length }}/{{ columns().length }})</span>
              }
            </div>
            <app-column-picker
              [columns]="columns()"
              [multiple]="allowMultipleAnalyze()"
              [(selectedColumns)]="analyzeVarNames"
              (selectedColumnsChange)="onAnalyzeVarsChange($event)"
            />
          </div>

          <!-- Group By (for Two/Three Variable modes) -->
          @if (showGroupBy()) {
            <div class="form-group">
              <div class="flex items-center gap-2">
                <label class="form-label">
                  {{ 'DESCRIBE.GROUP_BY' | translate }}
                </label>
                @if (service.graphMode() === 'comparison') {
                  <span class="text-xs text-base-content/60">({{ 'DIALOG.OPTIONAL' | translate }})</span>
                }
                <span 
                  class="tooltip tooltip-right cursor-help" 
                  [attr.data-tip]="'DESCRIBE.GROUP_BY_TOOLTIP' | translate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <select 
                class="select select-bordered w-full select-sm"
                [ngModel]="groupByVarName"
                (ngModelChange)="onGroupByChange($event)"
              >
                <option value="">{{ 'DIALOG.NONE' | translate }}</option>
                @for (col of availableGroupByColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }} ({{ col.type }})</option>
                }
              </select>
              <p class="text-xs text-base-content/50 mt-1">{{ 'DESCRIBE.GROUP_BY_HINT' | translate }}</p>
            </div>
          }

          <!-- Facet By (for Three Variable mode) -->
          @if (showFacetBy()) {
            <div class="form-group">
              <div class="flex items-center gap-2">
                <label class="form-label">
                  {{ 'DESCRIBE.FACET_BY' | translate }}
                </label>
                <span class="text-xs text-base-content/60">({{ 'DIALOG.OPTIONAL' | translate }})</span>
                <span 
                  class="tooltip tooltip-right cursor-help" 
                  [attr.data-tip]="'DESCRIBE.FACET_BY_TOOLTIP' | translate"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <select 
                class="select select-bordered w-full select-sm"
                [ngModel]="facetByVarName"
                (ngModelChange)="onFacetByChange($event)"
              >
                <option value="">{{ 'DIALOG.NONE' | translate }}</option>
                @for (col of factorColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
              <p class="text-xs text-base-content/50 mt-1">{{ 'DESCRIBE.FACET_BY_HINT' | translate }}</p>
            </div>
          }

          <!-- Variable Type Indicator -->
          @if (service.roles().analyze.length > 0) {
            <div class="type-indicator">
              <span class="badge badge-sm" [class]="getTypeBadgeClass()">
                {{ getTypeLabelKey() | translate }}
              </span>
            </div>
          }
        </div>

        <!-- Right Column: Output Options -->
        <div class="output-options">
          <!-- Output Mode Tabs -->
          <div class="tabs tabs-boxed mb-4">
            <button 
              class="tab tab-sm"
              [class.tab-active]="service.outputMode() === 'graph'"
              (click)="setOutputMode('graph')"
            >
              {{ 'DESCRIBE.GRAPH' | translate }}
            </button>
            <button 
              class="tab tab-sm"
              [class.tab-active]="service.outputMode() === 'frequency'"
              [disabled]="selectedColumns().length === 0"
              (click)="setOutputMode('frequency')"
            >
              {{ 'DESCRIBE.FREQUENCY' | translate }}
            </button>
          </div>

          <!-- Dynamic Panel Based on Output Mode -->
          <div class="panel-container">
            @switch (service.outputMode()) {
              @case ('graph') {
                <app-graph-panel 
                  [columns]="columns()"
                  [factorColumns]="factorColumns()"
                />
              }
              @case ('frequency') {
                <app-frequency-panel 
                  [columns]="columns()"
                  [numericColumns]="numericColumns()"
                />
              }
            }
          </div>

          <!-- Code Preview Toggle -->
          <div class="code-preview-section mt-4">
            <button 
              class="btn btn-ghost btn-xs gap-1"
              (click)="showCodePreview.set(!showCodePreview())"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {{ showCodePreview() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
            </button>
            
            @if (showCodePreview()) {
              <pre class="code-block mt-2">{{ service.rCode() }}</pre>
            }
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="service.reset()">{{ 'DIALOG.RESET' | translate }}</button>
        <div class="flex-1"></div>
        <span class="text-xs text-base-content/50 hidden sm:inline">
          {{ 'DIALOG.CTRL_ENTER' | translate }}
        </span>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!service.isValid() || isLoading()"
          [title]="'DIALOG.EXECUTE' | translate"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .describe-dialog {
      width: 700px;
      max-width: 90vw;
      max-height: 85vh;
    }

    .dialog-body {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 1.5rem;
      min-height: 400px;
    }

    .data-selection {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border-right: 1px solid hsl(var(--b3));
      padding-right: 1.5rem;
    }

    .output-options {
      display: flex;
      flex-direction: column;
    }

    .panel-container {
      flex: 1;
      overflow-y: auto;
    }

    .type-indicator {
      padding-top: 0.5rem;
      border-top: 1px solid hsl(var(--b3));
    }

    .code-block {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      max-height: 150px;
      white-space: pre-wrap;
    }

    .code-preview-section {
      border-top: 1px solid hsl(var(--b3));
      padding-top: 0.75rem;
    }
  `],
})
export class DescribeDialogComponent implements OnInit, OnDestroy {
  @Output() close = new EventEmitter<void>();
  
  /** 
   * Initial output mode - can be set via menu shortcuts
   * 'describe' = default (graph), 'describe:summary' = summary, 'describe:graph' = graph
   */
  @Input() initialMode: string = 'describe';

  readonly service = inject(DescribeDialogService);
  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  /**
   * Keyboard shortcuts:
   * - Ctrl+Enter / Cmd+Enter: Execute
   * - Ctrl+1: Switch to Summary tab
   * - Ctrl+2: Switch to Graph tab
   * - Ctrl+3: Switch to Frequency tab
   * - Ctrl+P: Toggle code preview
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    const isCtrl = event.ctrlKey || event.metaKey;
    
    if (isCtrl && event.key === 'Enter') {
      event.preventDefault();
      if (this.service.isValid() && !this.isLoading()) {
        this.execute();
      }
    } else if (isCtrl && event.key === '1') {
      event.preventDefault();
      this.setOutputMode('summary');
    } else if (isCtrl && event.key === '2') {
      event.preventDefault();
      this.setOutputMode('graph');
    } else if (isCtrl && event.key === '3') {
      event.preventDefault();
      this.setOutputMode('frequency');
    } else if (isCtrl && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      this.showCodePreview.update(v => !v);
    }
  }

  ngOnDestroy(): void {
    // Reset service state when dialog closes
    this.service.reset();
  }

  // Local state
  dataframes = signal<string[]>([]);
  columns = signal<ColumnInfo[]>([]);
  isLoading = signal(false);
  showCodePreview = signal(false);
  
  // UI control computed properties from service modeConfig
  showGroupBy = computed(() => 
    this.service.outputMode() !== 'graph' || this.service.modeConfig().showGroupBy
  );
  showFacetBy = computed(() => 
    this.service.outputMode() !== 'graph' || this.service.modeConfig().showFacetBy
  );
  allowMultipleAnalyze = computed(() => 
    this.service.outputMode() !== 'graph' || this.service.modeConfig().allowMultipleAnalyze
  );
  
  // Explicit variable role selections
  analyzeVarNames: string[] = [];
  groupByVarName = '';
  facetByVarName = '';

  // Computed: Selected columns (for backward compatibility)
  selectedColumns = computed(() => this.service.roles().analyze);
  
  // Computed: Columns available for groupBy (exclude already selected analyze vars)
  availableGroupByColumns = computed(() => {
    const analyzeNames = new Set(this.analyzeVarNames);
    return this.columns().filter(c => !analyzeNames.has(c.name));
  });
  
  factorColumns = computed(() => 
    this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('factor') || t.includes('character');
    })
  );

  numericColumns = computed(() =>
    this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('numeric') || t.includes('integer') || t.includes('double');
    })
  );

  async ngOnInit(): Promise<void> {
    // Set initial output mode based on menu shortcut
    if (this.initialMode === 'describe:summary') {
      this.service.setOutputMode('summary');
    } else if (this.initialMode === 'describe:graph') {
      this.service.setOutputMode('graph');
    }
    // 'describe' and default both use 'graph' which is the service default
    
    await this.loadDataframes();
  }

  private async loadDataframes(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);

    const active = this.rService.activeDataframe();
    if (active && dfs.includes(active)) {
      this.service.setDataframe(active);
      await this.loadColumns();
    } else if (dfs.length > 0) {
      this.service.setDataframe(dfs[0]);
      await this.loadColumns();
    }
  }

  private async loadColumns(): Promise<void> {
    const df = this.service.dataframe();
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

  async onDataframeChange(name: string): Promise<void> {
    this.service.setDataframe(name);
    this.analyzeVarNames = [];
    this.groupByVarName = '';
    this.facetByVarName = '';
    await this.loadColumns();
  }

  /**
   * Handle changes to the "Analyze" variable selection
   */
  onAnalyzeVarsChange(columnNames: string[]): void {
    const analyzeCols = this.columns().filter(c => columnNames.includes(c.name));
    this.service.setAnalyzeVariables(analyzeCols);
    
    // If groupBy is now in the analyze list, clear it
    if (this.groupByVarName && columnNames.includes(this.groupByVarName)) {
      this.groupByVarName = '';
      this.service.setGroupByVariable(undefined);
    }
  }

  /**
   * Handle changes to the "Group by" variable selection
   */
  onGroupByChange(columnName: string): void {
    this.groupByVarName = columnName;
    const groupByCol = columnName ? this.columns().find(c => c.name === columnName) : undefined;
    this.service.setGroupByVariable(groupByCol);
  }

  /**
   * Handle changes to the "Facet by" variable selection
   */
  onFacetByChange(columnName: string): void {
    this.facetByVarName = columnName;
    const facetByCol = columnName ? this.columns().find(c => c.name === columnName) : undefined;
    this.service.setFacetByVariable(facetByCol);
  }

  setOutputMode(mode: OutputMode): void {
    this.service.setOutputMode(mode);
  }

  setGraphMode(mode: GraphMode): void {
    this.service.setGraphMode(mode);
    // Clear inappropriate selections when changing mode
    const config = this.service.modeConfig();
    if (!config.allowMultipleAnalyze && this.analyzeVarNames.length > 1) {
      // Keep only first analyze variable
      this.analyzeVarNames = [this.analyzeVarNames[0]];
      this.onAnalyzeVarsChange(this.analyzeVarNames);
    }
    if (!config.showGroupBy) {
      this.groupByVarName = '';
      this.onGroupByChange('');
    }
    if (!config.showFacetBy) {
      this.facetByVarName = '';
      this.onFacetByChange('');
    }
  }

  getAnalyzeLabel(): string {
    if (this.service.outputMode() !== 'graph') {
      return 'DESCRIBE.ANALYZE';
    }
    // Use mode-specific labels
    return this.service.modeConfig().allowMultipleAnalyze 
      ? 'DESCRIBE.FIRST_VARIABLES' 
      : 'DESCRIBE.VARIABLE';
  }

  getTypeBadgeClass(): string {
    const combo = this.service.combination();
    switch (combo) {
      case 'single-numeric':
      case 'multi-numeric':
        return 'badge-info';
      case 'single-categorical':
      case 'multi-categorical':
        return 'badge-success';
      case 'numeric-by-categorical':
      case 'categorical-by-numeric':
        return 'badge-warning';
      case 'categorical-by-categorical':
        return 'badge-secondary';
      default:
        return 'badge-ghost';
    }
  }

  getTypeLabelKey(): string {
    const combo = this.service.combination();
    switch (combo) {
      case 'single-numeric': return 'DESCRIBE.TYPE_NUMERIC';
      case 'single-categorical': return 'DESCRIBE.TYPE_CATEGORICAL';
      case 'multi-numeric': return 'DESCRIBE.TYPE_MULTI_NUMERIC';
      case 'multi-categorical': return 'DESCRIBE.TYPE_MULTI_CATEGORICAL';
      case 'numeric-by-categorical': return 'DESCRIBE.TYPE_NUMERIC_BY_CATEGORICAL';
      case 'categorical-by-numeric': return 'DESCRIBE.TYPE_CATEGORICAL_BY_NUMERIC';
      case 'categorical-by-categorical': return 'DESCRIBE.TYPE_CATEGORICAL_BY_CATEGORICAL';
      case 'mixed': return 'DESCRIBE.TYPE_MIXED';
      default: return '';
    }
  }

  async execute(): Promise<void> {
    if (!this.service.isValid()) {
      this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE'));
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.service.execute();
      
      if (result.success) {
        this.toastService.success(this.languageService.instant('TOAST.COMMAND_SUCCESS'));
        this.close.emit();
      } else {
        this.toastService.error(result.error || this.languageService.instant('TOAST.COMMAND_FAILED'));
      }
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : this.languageService.instant('TOAST.COMMAND_FAILED')
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
