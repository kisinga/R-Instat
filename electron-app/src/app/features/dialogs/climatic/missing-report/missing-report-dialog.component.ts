/**
 * Missing Report Dialog Component
 * 
 * Dialog for generating missing values report.
 */

import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../../dialog-base';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { buildMissingReport, MissingReportOptions } from '../utils/climatic-r-builders';
import { rSyntax } from '../../../../core/r-codegen';
import { mapClimaticRolesToFields } from '../utils/climatic-role-mapper';

@Component({
  selector: 'app-missing-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.MISSING_REPORT' | translate }}</h2>
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

        <div class="form-group mt-4">
          <label class="form-label">{{ 'CLIMATIC.ELEMENT_COLUMNS' | translate }}</label>
          <div class="flex flex-wrap gap-2 mt-1">
            @for (col of getNumericColumns(); track col.name) {
              <label class="cursor-pointer flex items-center gap-1.5 bg-base-200 px-2 py-1 rounded">
                <input type="checkbox" class="checkbox checkbox-xs" 
                  [checked]="elementColumns().includes(col.name)"
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
              <input type="radio" name="level" class="radio radio-sm" value="annual" [checked]="level() === 'annual'" (change)="level.set('annual')" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_ANNUAL' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="monthly" [checked]="level() === 'monthly'" (change)="level.set('monthly')" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_MONTHLY' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input type="radio" name="level" class="radio radio-sm" value="overall" [checked]="level() === 'overall'" (change)="level.set('overall')" />
              <span class="text-sm">{{ 'CLIMATIC.LEVEL_OVERALL' | translate }}</span>
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
    .climatic-dialog { width: 550px; max-width: 90vw; }
    .code-block { background: hsl(var(--b2)); border-radius: 0.5rem; padding: 0.75rem; font-family: monospace; font-size: 0.7rem; overflow-x: auto; max-height: 150px; white-space: pre-wrap; }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class MissingReportDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Missing Report';

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  stationColumn = signal('');
  elementColumns = signal<string[]>([]);
  level = signal<'annual' | 'monthly' | 'overall'>('annual');

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      dateColumn: this.dateColumn,
      stationColumn: this.stationColumn,
      elementColumns: this.elementColumns,
      level: this.level,
    });

    // Register auto-population source from climatic roles
    // Special case: elementColumns is an array, so we add multiple roles
    this.registerAutoPopulateSource(() => {
      const df = this.selectedDataframe();
      if (!df) return null;
      const roles = this.climaticService.getRoles(df);
      const elementCols: string[] = [];
      if (roles.rain) elementCols.push(roles.rain);
      if (roles.tmax) elementCols.push(roles.tmax);
      if (roles.tmin) elementCols.push(roles.tmin);
      
      return {
        dateColumn: roles.date,
        stationColumn: roles.station,
        elementColumns: elementCols.length > 0 ? elementCols : undefined,
      };
    });

    // Initialize code manager with builder
    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return rSyntax().setBase('# Select a dataframe first');
      }

      const opts: MissingReportOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        elementColumns: this.elementColumns(),
        stationColumn: this.stationColumn() || undefined,
        level: this.level(),
      };
      return rSyntax().setBase(buildMissingReport(opts));
    });

    // Reactive updates
    this.createEffect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.stationColumn();
      this.elementColumns();
      this.level();
      this.rebuildRCode();
    });
  }

  toggleElement(colName: string): void {
    const cols = this.elementColumns();
    if (cols.includes(colName)) {
      this.elementColumns.set(cols.filter(c => c !== colName));
    } else {
      this.elementColumns.set([...cols, colName]);
    }
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
    return !!(this.selectedDataframe() && this.dateColumn() && this.elementColumns().length > 0);
  }
}
