/**
 * Unstack Dialog Component
 * 
 * Dialog for unstacking data (long to wide format) using tidyr::pivot_wider.
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
  selector: 'app-unstack-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content unstack-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'UNSTACK.TITLE' | translate }}</h2>
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
          <!-- Names From -->
          <div class="form-group">
            <label class="form-label">{{ 'UNSTACK.NAMES_FROM' | translate }}</label>
            <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [(selectedColumn)]="namesFrom" />
            <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.NAMES_HINT' | translate }}</p>
          </div>

          <!-- Values From -->
          <div class="form-group">
            <label class="form-label">{{ 'UNSTACK.VALUES_FROM' | translate }}</label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [(selectedColumn)]="valuesFrom" />
            <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.VALUES_HINT' | translate }}</p>
          </div>
        </div>

        <!-- Values Fill -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'UNSTACK.VALUES_FILL' | translate }}</label>
          <input type="text" class="input input-bordered w-full input-sm" [(ngModel)]="valuesFill" placeholder="NA" />
          <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.FILL_HINT' | translate }}</p>
        </div>

        <!-- Result Name -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'UNSTACK.RESULT_NAME' | translate }}</label>
          <input type="text" class="input input-bordered w-full input-sm" [(ngModel)]="resultName" placeholder="unstacked_data" />
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
    .unstack-dialog { width: 550px; max-width: 90vw; }
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
export class UnstackDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  dataframes = signal<string[]>([]);
  selectedDataframe = '';
  columns = signal<ColumnInfo[]>([]);
  namesFrom = '';
  valuesFrom = '';
  valuesFill = '';
  resultName = 'unstacked_data';
  
  isLoading = signal(false);
  showCode = signal(false);

  rCode = computed(() => {
    if (!this.selectedDataframe || !this.namesFrom || !this.valuesFrom) {
      return '# Select dataframe and columns';
    }
    
    let code = `${this.resultName || 'unstacked_data'} <- get_dataframe("${this.selectedDataframe}") %>%\n`;
    code += `  tidyr::pivot_wider(\n`;
    code += `    names_from = ${this.namesFrom},\n`;
    code += `    values_from = ${this.valuesFrom}`;
    
    if (this.valuesFill && this.valuesFill !== 'NA') {
      // Try to parse as number, otherwise treat as string
      const fillValue = isNaN(Number(this.valuesFill)) 
        ? `"${this.valuesFill}"` 
        : this.valuesFill;
      code += `,\n    values_fill = ${fillValue}`;
    }
    
    code += `\n  )`;
    code += `\ndata_store[["${this.resultName || 'unstacked_data'}"]] <- ${this.resultName || 'unstacked_data'}`;
    
    return code;
  });

  get isValid(): boolean {
    return !!(
      this.selectedDataframe && 
      this.namesFrom &&
      this.valuesFrom &&
      this.resultName
    );
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
    this.namesFrom = '';
    this.valuesFrom = '';
    await this.loadColumns();
  }

  private async loadColumns(): Promise<void> {
    if (!this.selectedDataframe) { this.columns.set([]); return; }
    try {
      const cols = await this.rService.getColumnInfo(this.selectedDataframe);
      this.columns.set(cols);
    } catch { this.columns.set([]); }
  }

  getFactorColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('factor') || t.includes('character');
    });
  }

  getNumericColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('numeric') || t.includes('integer') || t.includes('double');
    });
  }

  async execute(): Promise<void> {
    if (!this.isValid) {
      this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE'));
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(this.rCode(), true);

      if (result.success) {
        await this.rService.refreshDataframes();
        this.toastService.success(this.languageService.instant('UNSTACK.SUCCESS'));
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
