/**
 * Temperature Summary Dialog Component
 * 
 * Dialog for temperature statistics by period.
 */

import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../../dialog-base';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { buildTemperatureSummary, TemperatureSummaryOptions } from '../utils/climatic-r-builders';
import { rSyntax } from '../../../../core/r-codegen';

@Component({
  selector: 'app-temperature-summary-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.TEMPERATURE_SUMMARY' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
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
            <app-column-picker [columns]="getDateColumns()" [multiple]="false" [selectedColumn]="dateColumn()" (selectedColumnChange)="dateColumn.set($event)" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.STATION_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
            <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [selectedColumn]="stationColumn()" (selectedColumnChange)="stationColumn.set($event)" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.TMAX_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [selectedColumn]="tmaxColumn()" (selectedColumnChange)="tmaxColumn.set($event)" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.TMIN_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [selectedColumn]="tminColumn()" (selectedColumnChange)="tminColumn.set($event)" />
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.SUMMARY_LEVEL' | translate }}</label>
          <div class="flex gap-4">
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="annual" [checked]="level() === 'annual'" (change)="level.set('annual')" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_ANNUAL' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="monthly" [checked]="level() === 'monthly'" (change)="level.set('monthly')" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_MONTHLY' | translate }}</span>
            </label>
          </div>
        </div>

        <div class="code-preview-section mt-4">
          <button class="btn btn-ghost btn-xs gap-1" (click)="toggleCodePreview()">
            {{ showCodePreview() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          @if (showCodePreview()) { <pre class="code-block mt-2">{{ rCode() }}</pre> }
        </div>
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
          @if (isLoading()) { <span class="loading loading-spinner loading-sm"></span> }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .climatic-dialog { width: 500px; max-width: 90vw; }
    .code-block { background: hsl(var(--b2)); border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.7rem; overflow-x: auto; max-height: 150px; white-space: pre-wrap; }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class TemperatureSummaryDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Temperature Summary';

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  stationColumn = signal('');
  tmaxColumn = signal('');
  tminColumn = signal('');
  level = signal<'annual' | 'monthly'>('annual');

  override ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager with builder
    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return rSyntax().setBase('# Select a dataframe first');
      }

      const opts: TemperatureSummaryOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        tmaxColumn: this.tmaxColumn() || undefined,
        tminColumn: this.tminColumn() || undefined,
        stationColumn: this.stationColumn() || undefined,
        level: this.level(),
      };
      return rSyntax().setBase(buildTemperatureSummary(opts));
    });

    // Reactive updates
    effect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.stationColumn();
      this.tmaxColumn();
      this.tminColumn();
      this.level();
      this.rebuildRCode();
    });
  }

  override onDataframeChanged(): void {
    this.autoFillFromRoles();
  }

  override async onDataframeChange(name: string): Promise<void> {
    this.dateColumn.set('');
    this.stationColumn.set('');
    this.tmaxColumn.set('');
    this.tminColumn.set('');
    await super.onDataframeChange(name);
  }

  private autoFillFromRoles(): void {
    const df = this.selectedDataframe();
    if (!df) return;
    const roles = this.climaticService.getRoles(df);
    if (roles.date && !this.dateColumn()) this.dateColumn.set(roles.date);
    if (roles.station && !this.stationColumn()) this.stationColumn.set(roles.station);
    if (roles.tmax && !this.tmaxColumn()) this.tmaxColumn.set(roles.tmax);
    if (roles.tmin && !this.tminColumn()) this.tminColumn.set(roles.tmin);
  }

  // Enhanced date column detection (includes character columns with date-like names)
  override getDateColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      const n = c.name.toLowerCase();
      if (t.includes('date') || t.includes('posix')) return true;
      if (t.includes('character')) return n.includes('date') || n.includes('time') || n === 'day';
      return false;
    });
  }

  isValid(): boolean {
    return !!(this.selectedDataframe() && this.dateColumn() && (this.tmaxColumn() || this.tminColumn()));
  }

  protected override getCurrentDefaults(): Record<string, unknown> {
    return {
      dateColumn: this.dateColumn(),
      stationColumn: this.stationColumn(),
      tmaxColumn: this.tmaxColumn(),
      tminColumn: this.tminColumn(),
      level: this.level(),
    };
  }

  protected override applyDefaults(defaults: Record<string, unknown>): void {
    if (defaults['dateColumn']) this.dateColumn.set(defaults['dateColumn'] as string);
    if (defaults['stationColumn']) this.stationColumn.set(defaults['stationColumn'] as string);
    if (defaults['tmaxColumn']) this.tmaxColumn.set(defaults['tmaxColumn'] as string);
    if (defaults['tminColumn']) this.tminColumn.set(defaults['tminColumn'] as string);
    if (defaults['level']) this.level.set(defaults['level'] as 'annual' | 'monthly');
  }
}
