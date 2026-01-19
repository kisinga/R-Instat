/**
 * Stack Dialog Component
 * 
 * Dialog for stacking data (wide to long format) using tidyr::pivot_longer.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { ColumnInfo } from '../../../core/models/r.model';

@Component({
  selector: 'app-stack-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content stack-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'STACK.TITLE' | translate }}</h2>
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

        <!-- Columns to Stack -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'STACK.COLUMNS_TO_STACK' | translate }}</label>
          <p class="text-xs text-base-content/60 mb-2">{{ 'STACK.COLUMNS_HINT' | translate }}</p>
          <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-base-200 rounded-lg">
            @for (col of columns(); track col.name) {
              <label class="cursor-pointer flex items-center gap-1.5 bg-base-100 px-2 py-1 rounded shadow-sm">
                <input type="checkbox" class="checkbox checkbox-xs" 
                  [checked]="columnsToStack.includes(col.name)"
                  (change)="toggleColumn(col.name)" />
                <span class="text-sm">{{ col.name }}</span>
              </label>
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <!-- Names To -->
          <div class="form-group">
            <label class="form-label">{{ 'STACK.NAMES_TO' | translate }}</label>
            <input type="text" class="input input-bordered w-full input-sm" [(ngModel)]="namesTo" placeholder="variable" />
            <p class="text-xs text-base-content/60 mt-1">{{ 'STACK.NAMES_HINT' | translate }}</p>
          </div>

          <!-- Values To -->
          <div class="form-group">
            <label class="form-label">{{ 'STACK.VALUES_TO' | translate }}</label>
            <input type="text" class="input input-bordered w-full input-sm" [(ngModel)]="valuesTo" placeholder="value" />
            <p class="text-xs text-base-content/60 mt-1">{{ 'STACK.VALUES_HINT' | translate }}</p>
          </div>
        </div>

        <!-- Options -->
        <div class="form-group mt-4">
          <label class="cursor-pointer flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" [(ngModel)]="dropNA" />
            <span class="text-sm">{{ 'STACK.DROP_NA' | translate }}</span>
          </label>
        </div>

        <!-- Result Name -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'STACK.RESULT_NAME' | translate }}</label>
          <input type="text" class="input input-bordered w-full input-sm" [(ngModel)]="resultName" placeholder="stacked_data" />
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
    .stack-dialog { width: 550px; max-width: 90vw; }
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
export class StackDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  dataframes = signal<string[]>([]);
  selectedDataframe = '';
  columns = signal<ColumnInfo[]>([]);
  columnsToStack: string[] = [];
  namesTo = 'variable';
  valuesTo = 'value';
  dropNA = true;
  resultName = 'stacked_data';
  
  isLoading = signal(false);
  showCode = signal(false);

  rCode = computed(() => {
    if (!this.selectedDataframe || this.columnsToStack.length === 0) {
      return '# Select dataframe and columns to stack';
    }
    
    const cols = this.columnsToStack.map(c => `"${c}"`).join(', ');
    
    let code = `${this.resultName || 'stacked_data'} <- get_dataframe("${this.selectedDataframe}") %>%\n`;
    code += `  tidyr::pivot_longer(\n`;
    code += `    cols = c(${cols}),\n`;
    code += `    names_to = "${this.namesTo || 'variable'}",\n`;
    code += `    values_to = "${this.valuesTo || 'value'}"`;
    if (this.dropNA) {
      code += `,\n    values_drop_na = TRUE`;
    }
    code += `\n  )`;
    code += `\ndata_store[["${this.resultName || 'stacked_data'}"]] <- ${this.resultName || 'stacked_data'}`;
    
    return code;
  });

  get isValid(): boolean {
    return !!(
      this.selectedDataframe && 
      this.columnsToStack.length > 0 &&
      this.namesTo &&
      this.valuesTo &&
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
    this.columnsToStack = [];
    await this.loadColumns();
  }

  private async loadColumns(): Promise<void> {
    if (!this.selectedDataframe) { this.columns.set([]); return; }
    try {
      const cols = await this.rService.getColumnInfo(this.selectedDataframe);
      this.columns.set(cols);
    } catch { this.columns.set([]); }
  }

  toggleColumn(colName: string): void {
    const idx = this.columnsToStack.indexOf(colName);
    if (idx >= 0) {
      this.columnsToStack.splice(idx, 1);
    } else {
      this.columnsToStack.push(colName);
    }
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
        this.toastService.success(this.languageService.instant('STACK.SUCCESS'));
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
