/**
 * Describe Dialog Component
 * 
 * Unified dialog for describing data through summaries, graphs, and frequencies.
 * Adapts available options based on selected variable types.
 */

import { Component, signal, computed, inject, OnInit, OnDestroy, Output, EventEmitter, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { ColumnInfo } from '../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { DescribeDialogService, OutputMode } from './describe-dialog.service';
import { SummaryPanelComponent } from './panels/summary-panel.component';
import { GraphPanelComponent } from './panels/graph-panel.component';
import { FrequencyPanelComponent } from './panels/frequency-panel.component';

@Component({
  selector: 'app-describe-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ColumnPickerComponent,
    SummaryPanelComponent,
    GraphPanelComponent,
    FrequencyPanelComponent,
  ],
  providers: [DescribeDialogService],
  template: `
    <div class="dialog-content describe-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">Describe Data</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <!-- Left Column: Data Selection -->
        <div class="data-selection">
          <!-- Dataframe Selection -->
          <div class="form-group">
            <label class="form-label">Data Frame</label>
            @if (dataframes().length === 0) {
              <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
                No data loaded. Import data first.
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

          <!-- Column Selection -->
          <div class="form-group flex-1">
            <div class="flex items-center justify-between">
              <label class="form-label">
                Variables 
                <span class="text-xs text-base-content/60">({{ selectedColumns().length }}/{{ columns().length }})</span>
              </label>
              <div class="flex gap-1">
                <button 
                  class="btn btn-ghost btn-xs"
                  (click)="selectAllColumns()"
                  [disabled]="columns().length === 0"
                >All</button>
                <button 
                  class="btn btn-ghost btn-xs"
                  (click)="clearColumns()"
                  [disabled]="selectedColumns().length === 0"
                >None</button>
              </div>
            </div>
            <app-column-picker
              [columns]="columns()"
              [multiple]="true"
              [(selectedColumns)]="selectedColumnsNames"
              (selectedColumnsChange)="onColumnsChange($event)"
            />
          </div>

          <!-- Variable Type Indicator -->
          @if (service.analysis().combination !== 'none') {
            <div class="type-indicator">
              <span class="badge badge-sm" [class]="getTypeBadgeClass()">
                {{ getTypeLabel() }}
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
              [class.tab-active]="service.outputMode() === 'summary'"
              [disabled]="selectedColumns().length === 0"
              (click)="setOutputMode('summary')"
            >
              Summary
            </button>
            <button 
              class="tab tab-sm"
              [class.tab-active]="service.outputMode() === 'graph'"
              (click)="setOutputMode('graph')"
            >
              Graph
            </button>
            <button 
              class="tab tab-sm"
              [class.tab-active]="service.outputMode() === 'frequency'"
              [disabled]="selectedColumns().length === 0"
              (click)="setOutputMode('frequency')"
            >
              Frequency
            </button>
          </div>

          <!-- Dynamic Panel Based on Output Mode -->
          <div class="panel-container">
            @switch (service.outputMode()) {
              @case ('summary') {
                <app-summary-panel 
                  [columns]="columns()"
                  [factorColumns]="factorColumns()"
                />
              }
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
              {{ showCodePreview() ? 'Hide' : 'Show' }} R Code
            </button>
            
            @if (showCodePreview()) {
              <pre class="code-block mt-2">{{ service.rCode() }}</pre>
            }
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="service.reset()">Reset</button>
        <div class="flex-1"></div>
        <span class="text-xs text-base-content/50 hidden sm:inline">
          Ctrl+Enter to run
        </span>
        <button class="btn btn-ghost" (click)="close.emit()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!service.isValid() || isLoading()"
          title="Execute (Ctrl+Enter)"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
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
  selectedColumnsNames: string[] = [];

  // Computed
  selectedColumns = computed(() => this.service.selectedColumns());
  
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
    this.selectedColumnsNames = [];
    await this.loadColumns();
  }

  onColumnsChange(columnNames: string[]): void {
    const selectedCols = this.columns().filter(c => columnNames.includes(c.name));
    this.service.setSelectedColumns(selectedCols);
  }

  selectAllColumns(): void {
    this.selectedColumnsNames = this.columns().map(c => c.name);
    this.service.setSelectedColumns(this.columns());
  }

  clearColumns(): void {
    this.selectedColumnsNames = [];
    this.service.setSelectedColumns([]);
  }

  setOutputMode(mode: OutputMode): void {
    this.service.setOutputMode(mode);
  }

  getTypeBadgeClass(): string {
    const combo = this.service.analysis().combination;
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

  getTypeLabel(): string {
    const combo = this.service.analysis().combination;
    switch (combo) {
      case 'single-numeric': return 'Numeric';
      case 'single-categorical': return 'Categorical';
      case 'multi-numeric': return 'Multiple Numeric';
      case 'multi-categorical': return 'Multiple Categorical';
      case 'numeric-by-categorical': return 'Numeric by Categorical';
      case 'categorical-by-numeric': return 'Categorical by Numeric';
      case 'categorical-by-categorical': return 'Categorical by Categorical';
      case 'mixed': return 'Mixed Types';
      default: return '';
    }
  }

  async execute(): Promise<void> {
    if (!this.service.isValid()) {
      this.toastService.warning('Please complete the form');
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.service.execute();
      
      if (result.success) {
        this.toastService.success('Command executed successfully');
        this.close.emit();
      } else {
        this.toastService.error(result.error || 'Command failed');
      }
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Failed to execute command'
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
