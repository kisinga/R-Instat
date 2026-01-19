/**
 * Dot Plot Dialog Component
 * 
 * Dialog for creating dot plots using ggplot2 geom_dotplot.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { ColumnInfo } from '../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-dot-plot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content dot-plot-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'DOT_PLOT.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          @if (dataframes().length === 0) {
            <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
              {{ 'DIALOG.NO_DATA' | translate }}
            </div>
          } @else {
            <select class="select select-bordered w-full select-sm" [(ngModel)]="selectedDataframe" (ngModelChange)="onDataframeChange($event)">
              @for (df of dataframes(); track df) {
                <option [value]="df">{{ df }}</option>
              }
            </select>
          }
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <!-- X Variable (Categorical) -->
          <div class="form-group">
            <label class="form-label">{{ 'DOT_PLOT.X_VARIABLE' | translate }}</label>
            <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [(selectedColumn)]="xVariable" />
            <p class="text-xs text-base-content/60 mt-1">{{ 'DOT_PLOT.X_HINT' | translate }}</p>
          </div>

          <!-- Y Variable (Numeric) -->
          <div class="form-group">
            <label class="form-label">{{ 'DOT_PLOT.Y_VARIABLE' | translate }}</label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [(selectedColumn)]="yVariable" />
          </div>
        </div>

        <!-- Fill By -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'DOT_PLOT.FILL_BY' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
          <select class="select select-bordered w-full select-sm" [(ngModel)]="fillBy">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Dot Size -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'DOT_PLOT.DOT_SIZE' | translate }}: {{ dotSize }}</label>
          <input type="range" class="range range-primary range-sm" min="0.1" max="2" step="0.1" [(ngModel)]="dotSize" />
        </div>

        <!-- Stack Direction -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'DOT_PLOT.STACK_DIRECTION' | translate }}</label>
          <div class="flex gap-4">
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="stackdir" class="radio radio-sm" value="center" [(ngModel)]="stackDirection" />
              <span class="text-sm">{{ 'DOT_PLOT.CENTER' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="stackdir" class="radio radio-sm" value="up" [(ngModel)]="stackDirection" />
              <span class="text-sm">{{ 'DOT_PLOT.UP' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="stackdir" class="radio radio-sm" value="down" [(ngModel)]="stackDirection" />
              <span class="text-sm">{{ 'DOT_PLOT.DOWN' | translate }}</span>
            </label>
          </div>
        </div>

        <!-- Code Preview -->
        <div class="code-preview-section mt-4">
          <button class="btn btn-ghost btn-xs gap-1" (click)="showCode.set(!showCode())">
            {{ showCode() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          @if (showCode()) {
            <pre class="code-block mt-2">{{ rCode() }}</pre>
          }
        </div>
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid || isLoading()"
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
    .dot-plot-dialog { width: 500px; max-width: 90vw; }
    .code-block { 
      background: hsl(var(--b2)); 
      border-radius: 0.5rem; 
      padding: 0.75rem; 
      font-family: monospace; 
      font-size: 0.7rem; 
      overflow-x: auto; 
      max-height: 150px; 
      white-space: pre-wrap; 
    }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class DotPlotDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  dataframes = signal<string[]>([]);
  selectedDataframe = '';
  columns = signal<ColumnInfo[]>([]);
  xVariable = '';
  yVariable = '';
  fillBy = '';
  dotSize = 0.5;
  stackDirection: 'center' | 'up' | 'down' = 'center';
  
  isLoading = signal(false);
  showCode = signal(false);

  rCode = computed(() => {
    if (!this.selectedDataframe || !this.xVariable || !this.yVariable) {
      return '# Select dataframe, X and Y variables';
    }
    
    let aesStr = `aes(x = ${this.xVariable}, y = ${this.yVariable}`;
    if (this.fillBy) {
      aesStr += `, fill = ${this.fillBy}`;
    }
    aesStr += ')';
    
    let code = `ggplot(get_dataframe("${this.selectedDataframe}"), ${aesStr}) +\n`;
    code += `  geom_dotplot(\n`;
    code += `    binaxis = "y",\n`;
    code += `    stackdir = "${this.stackDirection}",\n`;
    code += `    dotsize = ${this.dotSize}\n`;
    code += `  ) +\n`;
    code += `  theme_minimal() +\n`;
    code += `  labs(x = "${this.xVariable}", y = "${this.yVariable}")`;
    
    return code;
  });

  get isValid(): boolean {
    return !!(this.selectedDataframe && this.xVariable && this.yVariable);
  }

  async ngOnInit(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);
    
    const active = this.rService.activeDataframe();
    if (active && dfs.includes(active)) {
      this.selectedDataframe = active;
      await this.loadColumns();
    } else if (dfs.length > 0) {
      this.selectedDataframe = dfs[0];
      await this.loadColumns();
    }
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe = name;
    this.xVariable = '';
    this.yVariable = '';
    this.fillBy = '';
    await this.loadColumns();
  }

  private async loadColumns(): Promise<void> {
    if (!this.selectedDataframe) { this.columns.set([]); return; }
    try {
      const cols = await this.rService.getColumnInfo(this.selectedDataframe);
      this.columns.set(cols);
    } catch { this.columns.set([]); }
  }

  getNumericColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('numeric') || t.includes('integer') || t.includes('double');
    });
  }

  getFactorColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('factor') || t.includes('character');
    });
  }

  async execute(): Promise<void> {
    if (!this.isValid) {
      this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE'));
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(this.rCode());

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
