/**
 * Extremes Dialog Component
 * 
 * Dialog for finding max/min values by period.
 */

import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../../dialog-base';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { buildExtremes, ExtremesOptions } from '../utils/climatic-r-builders';
import { rSyntax } from '../../../../core/r-codegen';

@Component({
  selector: 'app-extremes-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.EXTREMES' | translate }}</h2>
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
            <label class="form-label">{{ 'CLIMATIC.ELEMENT_COLUMN' | translate }}</label>
            <app-column-picker [columns]="getNumericColumns()" [multiple]="false" [selectedColumn]="elementColumn()" (selectedColumnChange)="elementColumn.set($event)" />
          </div>
        </div>

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.STATION_COLUMN' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
          <app-column-picker [columns]="getFactorColumns()" [multiple]="false" [selectedColumn]="stationColumn()" (selectedColumnChange)="stationColumn.set($event)" />
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.SUMMARY_LEVEL' | translate }}</label>
            <select class="select select-bordered w-full select-sm" [ngModel]="level()" (ngModelChange)="level.set($event)">
              <option value="annual">{{ 'CLIMATIC.LEVEL_ANNUAL' | translate }}</option>
              <option value="monthly">{{ 'CLIMATIC.LEVEL_MONTHLY' | translate }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.FIND_EXTREMES' | translate }}</label>
            <div class="flex gap-4">
              <label class="cursor-pointer flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm" [checked]="findMax()" (change)="findMax.set($any($event.target).checked)" />
                <span class="text-sm">{{ 'CLIMATIC.MAXIMUM' | translate }}</span>
              </label>
              <label class="cursor-pointer flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm" [checked]="findMin()" (change)="findMin.set($any($event.target).checked)" />
                <span class="text-sm">{{ 'CLIMATIC.MINIMUM' | translate }}</span>
              </label>
            </div>
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
    .climatic-dialog { width: 550px; max-width: 90vw; }
    .code-block { background: hsl(var(--b2)); border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.75rem; overflow-x: auto; max-height: 120px; white-space: pre-wrap; }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class ExtremesDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Extremes';

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  elementColumn = signal('');
  stationColumn = signal('');
  level = signal<'annual' | 'monthly'>('annual');
  findMax = signal(true);
  findMin = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager with builder
    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return rSyntax().setBase('# Select a dataframe first');
      }

      const opts: ExtremesOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        elementColumn: this.elementColumn(),
        stationColumn: this.stationColumn() || undefined,
        level: this.level(),
        findMax: this.findMax(),
        findMin: this.findMin(),
      };
      return rSyntax().setBase(buildExtremes(opts));
    });

    // Reactive updates
    effect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.elementColumn();
      this.stationColumn();
      this.level();
      this.findMax();
      this.findMin();
      this.rebuildRCode();
    });
  }

  override onDataframeChanged(): void {
    this.autoFillFromRoles();
  }

  override async onDataframeChange(name: string): Promise<void> {
    this.dateColumn.set('');
    this.elementColumn.set('');
    this.stationColumn.set('');
    await super.onDataframeChange(name);
  }

  private autoFillFromRoles(): void {
    const df = this.selectedDataframe();
    if (!df) return;
    const roles = this.climaticService.getRoles(df);
    if (roles.date && !this.dateColumn()) this.dateColumn.set(roles.date);
    if (roles.rain && !this.elementColumn()) this.elementColumn.set(roles.rain);
    if (roles.station && !this.stationColumn()) this.stationColumn.set(roles.station);
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
    return !!(this.selectedDataframe() && this.dateColumn() && this.elementColumn() && (this.findMax() || this.findMin()));
  }

  protected override getCurrentDefaults(): Record<string, unknown> {
    return {
      dateColumn: this.dateColumn(),
      elementColumn: this.elementColumn(),
      stationColumn: this.stationColumn(),
      level: this.level(),
      findMax: this.findMax(),
      findMin: this.findMin(),
    };
  }

  protected override applyDefaults(defaults: Record<string, unknown>): void {
    if (defaults['dateColumn']) this.dateColumn.set(defaults['dateColumn'] as string);
    if (defaults['elementColumn']) this.elementColumn.set(defaults['elementColumn'] as string);
    if (defaults['stationColumn']) this.stationColumn.set(defaults['stationColumn'] as string);
    if (defaults['level']) this.level.set(defaults['level'] as 'annual' | 'monthly');
    if (defaults['findMax'] !== undefined) this.findMax.set(defaults['findMax'] as boolean);
    if (defaults['findMin'] !== undefined) this.findMin.set(defaults['findMin'] as boolean);
  }
}
