/**
 * Missing Report Dialog Component
 * 
 * Dialog for generating missing values report.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { buildMissingReport, MissingReportOptions } from '../utils/climatic-r-builders';

@Component({
  selector: 'app-missing-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.MISSING_REPORT' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <div class="dialog-body">
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          @if (dataframes().length === 0) {
            <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">{{ 'DIALOG.NO_DATA' | translate }}</div>
          } @else {
            <select class="select select-bordered w-full select-sm" [ngModel]="selectedDataframe()" (ngModelChange)="onDataframeChange($event)">
              @for (df of dataframes(); track df) { <option [value]="df">{{ df }}</option> }
            </select>
          }
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.DATE_COLUMN' | translate }}</label>
            <app-column-picker [columns]="getDateColumns()" [multiple]="false" [(selectedColumn)]="dateColumn" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.STATION_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
            <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [(selectedColumn)]="stationColumn" />
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.ELEMENT_COLUMNS' | translate }}</label>
          <div class="flex flex-wrap gap-2 mt-1">
            @for (col of getNumericColumns(); track col.name) {
              <label class="cursor-pointer flex items-center gap-1.5 bg-base-200 px-2 py-1 rounded">
                <input type="checkbox" class="checkbox checkbox-xs" 
                  [checked]="elementColumns.includes(col.name)"
                  (change)="toggleElement(col.name)" />
                <span class="text-sm">{{ col.name }}</span>
              </label>
            }
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.REPORT_LEVEL' | translate }}</label>
          <div class="flex gap-4">
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="annual" [(ngModel)]="level" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_ANNUAL' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="monthly" [(ngModel)]="level" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_MONTHLY' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="overall" [(ngModel)]="level" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_OVERALL' | translate }}</span>
            </label>
          </div>
        </div>

        <div class="code-preview-section mt-4">
          <button class="btn btn-ghost btn-xs gap-1" (click)="showCode.set(!showCode())">
            {{ showCode() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          @if (showCode()) { <pre class="code-block mt-2">{{ rCode() }}</pre> }
        </div>
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
          @if (isLoading()) { <span class="loading loading-spinner loading-sm"></span> }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .climatic-dialog { width: 550px; max-width: 90vw; }
    .code-block { background: hsl(var(--b2)); border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.7rem; overflow-x: auto; max-height: 150px; white-space: pre-wrap; }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class MissingReportDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly climaticService = inject(ClimaticDataService);

  dataframes = signal<string[]>([]);
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  
  dateColumn = '';
  stationColumn = '';
  elementColumns: string[] = [];
  level: 'annual' | 'monthly' | 'overall' = 'annual';
  
  isLoading = signal(false);
  showCode = signal(false);

  rCode = computed(() => {
    const opts: MissingReportOptions = {
      dataframe: this.selectedDataframe(),
      dateColumn: this.dateColumn,
      elementColumns: this.elementColumns,
      stationColumn: this.stationColumn || undefined,
      level: this.level,
    };
    return buildMissingReport(opts);
  });

  isValid = computed(() => !!(this.selectedDataframe() && this.dateColumn && this.elementColumns.length > 0));

  async ngOnInit(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);
    const active = this.rService.activeDataframe();
    if (active && dfs.includes(active)) { this.selectedDataframe.set(active); await this.loadColumns(); }
    else if (dfs.length > 0) { this.selectedDataframe.set(dfs[0]); await this.loadColumns(); }
  }

  private async loadColumns(): Promise<void> {
    const df = this.selectedDataframe();
    if (!df) { this.columns.set([]); return; }
    try { const columnInfo = await this.rService.getColumnInfo(df); this.columns.set(columnInfo); this.autoFillFromRoles(); }
    catch { this.columns.set([]); }
  }

  private autoFillFromRoles(): void {
    const df = this.selectedDataframe();
    if (!df) return;
    const roles = this.climaticService.getRoles(df);
    if (roles.date && !this.dateColumn) this.dateColumn = roles.date;
    if (roles.station && !this.stationColumn) this.stationColumn = roles.station;
    // Auto-select rain, tmax, tmin if available
    if (roles.rain && !this.elementColumns.includes(roles.rain)) this.elementColumns.push(roles.rain);
    if (roles.tmax && !this.elementColumns.includes(roles.tmax)) this.elementColumns.push(roles.tmax);
    if (roles.tmin && !this.elementColumns.includes(roles.tmin)) this.elementColumns.push(roles.tmin);
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    this.dateColumn = ''; this.stationColumn = ''; this.elementColumns = [];
    await this.loadColumns();
  }

  toggleElement(colName: string): void {
    const idx = this.elementColumns.indexOf(colName);
    if (idx >= 0) { this.elementColumns.splice(idx, 1); }
    else { this.elementColumns.push(colName); }
  }

  getDateColumns(): ColumnInfo[] { return this.columns().filter(c => { const t = c.type.toLowerCase(); return t.includes('date') || t.includes('posix') || t.includes('character'); }); }
  getNumericColumns(): ColumnInfo[] { return this.columns().filter(c => { const t = c.type.toLowerCase(); return t.includes('numeric') || t.includes('integer') || t.includes('double'); }); }
  getFactorColumns(): ColumnInfo[] { return this.columns().filter(c => { const t = c.type.toLowerCase(); return t.includes('factor') || t.includes('character'); }); }

  async execute(): Promise<void> {
    if (!this.isValid()) { this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE')); return; }
    this.isLoading.set(true);
    try {
      const result = await this.rService.execute(this.rCode());
      if (result.success) { this.toastService.success(this.languageService.instant('TOAST.COMMAND_SUCCESS')); this.close.emit(); }
      else { this.toastService.error(result.error || this.languageService.instant('TOAST.COMMAND_FAILED')); }
    } catch (error) { this.toastService.error(error instanceof Error ? error.message : this.languageService.instant('TOAST.COMMAND_FAILED')); }
    finally { this.isLoading.set(false); }
  }
}
