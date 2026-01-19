/**
 * Spell Lengths Dialog Component
 * 
 * Dialog for wet/dry spell analysis using run-length encoding.
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
import { buildSpellLengths, SpellLengthsOptions } from '../utils/climatic-r-builders';

@Component({
  selector: 'app-spell-lengths-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.SPELL_LENGTHS' | translate }}</h2>
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
            <label class="form-label">{{ 'CLIMATIC.ELEMENT_COLUMN' | translate }}</label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [(selectedColumn)]="elementColumn" />
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.STATION_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
          <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [(selectedColumn)]="stationColumn" />
        </div>

        <div class="grid grid-cols-3 gap-4 mt-4">
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.SPELL_TYPE' | translate }}</label>
            <select class="select select-bordered w-full select-sm" [(ngModel)]="spellType">
              <option value="wet">{{ 'CLIMATIC.WET_SPELL' | translate }}</option>
              <option value="dry">{{ 'CLIMATIC.DRY_SPELL' | translate }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.THRESHOLD' | translate }}</label>
            <input type="number" class="input input-bordered w-full input-sm" [(ngModel)]="threshold" step="0.1" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.STATISTIC' | translate }}</label>
            <select class="select select-bordered w-full select-sm" [(ngModel)]="statistic">
              <option value="max">{{ 'CLIMATIC.MAXIMUM' | translate }}</option>
              <option value="mean">{{ 'CLIMATIC.MEAN' | translate }}</option>
              <option value="count">{{ 'CLIMATIC.COUNT' | translate }}</option>
            </select>
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
export class SpellLengthsDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly climaticService = inject(ClimaticDataService);

  dataframes = signal<string[]>([]);
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  
  dateColumn = '';
  elementColumn = '';
  stationColumn = '';
  spellType: 'wet' | 'dry' = 'wet';
  threshold = 1;
  statistic: 'max' | 'mean' | 'count' = 'max';
  
  isLoading = signal(false);
  showCode = signal(false);

  rCode = computed(() => {
    const opts: SpellLengthsOptions = {
      dataframe: this.selectedDataframe(),
      dateColumn: this.dateColumn,
      elementColumn: this.elementColumn,
      stationColumn: this.stationColumn || undefined,
      spellType: this.spellType,
      threshold: this.threshold,
      statistic: this.statistic,
    };
    return buildSpellLengths(opts);
  });

  isValid = computed(() => !!(this.selectedDataframe() && this.dateColumn && this.elementColumn));

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
    if (roles.rain && !this.elementColumn) this.elementColumn = roles.rain;
    if (roles.station && !this.stationColumn) this.stationColumn = roles.station;
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    this.dateColumn = ''; this.elementColumn = ''; this.stationColumn = '';
    await this.loadColumns();
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
