/**
 * Summary Dialog Component
 * 
 * Focused dialog for generating summary statistics.
 * Separated from the Describe dialog for clearer UX.
 */

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { LanguageService } from '../../../core/services/language.service';
import { 
  buildSummaryCode, 
  SummaryMode, 
  SummaryStatistic 
} from '../describe/utils/r-code-builders';

interface SummaryModeOption {
  value: SummaryMode;
  labelKey: string;
  descriptionKey: string;
}

interface StatisticOption {
  value: SummaryStatistic;
  labelKey: string;
}

@Component({
  selector: 'app-summary-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'SUMMARY.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <div class="grid grid-cols-2 gap-6">
          <!-- Left Column: Data Selection -->
          <div class="space-y-4">
            <!-- Dataframe Selection -->
            <div class="form-group">
              <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
              <select 
                class="select select-bordered w-full select-sm"
                [ngModel]="selectedDataframe()"
                (ngModelChange)="onDataframeChange($event)"
              >
                @for (df of dataframes(); track df) {
                  <option [value]="df">{{ df }}</option>
                }
              </select>
            </div>

            <!-- Variables to Summarize -->
            <div class="form-group">
              <div class="flex items-center gap-2">
                <label class="form-label">{{ 'SUMMARY.VARIABLES' | translate }}</label>
                <span class="text-xs text-base-content/60">({{ selectedColumns.length }}/{{ columns().length }})</span>
              </div>
              <app-column-picker
                [columns]="columns()"
                [multiple]="true"
                [(selectedColumns)]="selectedColumns"
              />
            </div>

            <!-- Group By (optional) -->
            <div class="form-group">
              <div class="flex items-center gap-2">
                <label class="form-label">{{ 'SUMMARY.GROUP_BY' | translate }}</label>
                <span class="text-xs text-base-content/60">({{ 'DIALOG.OPTIONAL' | translate }})</span>
              </div>
              <select 
                class="select select-bordered w-full select-sm"
                [(ngModel)]="groupByColumn"
              >
                <option value="">{{ 'DIALOG.NONE' | translate }}</option>
                @for (col of getFactorColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }} ({{ col.type }})</option>
                }
              </select>
              <p class="text-xs text-base-content/50 mt-1">{{ 'SUMMARY.GROUP_BY_HINT' | translate }}</p>
            </div>
          </div>

          <!-- Right Column: Summary Options -->
          <div class="space-y-4">
            <!-- Summary Mode Selection -->
            <div class="form-group">
              <label class="form-label">{{ 'SUMMARY.TYPE' | translate }}</label>
              <div class="space-y-2">
                @for (mode of summaryModes; track mode.value) {
                  <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-3 py-2">
                    <input 
                      type="radio" 
                      class="radio radio-sm radio-primary"
                      [value]="mode.value"
                      [checked]="summaryMode() === mode.value"
                      (change)="summaryMode.set(mode.value)"
                      name="summaryMode"
                    />
                    <div class="flex flex-col flex-1">
                      <span class="text-sm font-medium">{{ mode.labelKey | translate }}</span>
                      <span class="text-xs text-base-content/60">{{ mode.descriptionKey | translate }}</span>
                    </div>
                  </label>
                }
              </div>
            </div>

            <!-- Statistics Selection (only for customised mode) -->
            @if (summaryMode() === 'customised') {
              <div class="form-group">
                <label class="form-label">{{ 'SUMMARY.STATISTICS' | translate }}</label>
                <div class="grid grid-cols-3 gap-2">
                  @for (stat of statisticOptions; track stat.value) {
                    <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-2 py-1.5">
                      <input 
                        type="checkbox" 
                        class="checkbox checkbox-sm checkbox-primary"
                        [checked]="selectedStatistics().includes(stat.value)"
                        (change)="toggleStatistic(stat.value)"
                      />
                      <span class="text-sm">{{ stat.labelKey | translate }}</span>
                    </label>
                  }
                </div>
              </div>

              <!-- Omit Missing Values -->
              <div class="form-group">
                <label class="label cursor-pointer justify-start gap-2">
                  <input 
                    type="checkbox" 
                    class="checkbox checkbox-sm checkbox-primary"
                    [checked]="omitMissing()"
                    (change)="omitMissing.set($any($event.target).checked)"
                  />
                  <span class="text-sm">{{ 'SUMMARY.OMIT_MISSING' | translate }}</span>
                </label>
              </div>
            }
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">{{ 'DIALOG.CODE_PREVIEW' | translate }}</label>
            <pre class="code-block text-xs bg-base-200 p-3 rounded-lg overflow-x-auto">{{ buildRCode() }}</pre>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ (showCodePreview() ? 'DIALOG.HIDE_CODE' : 'DIALOG.SHOW_CODE') | translate }}
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class SummaryDialogComponent extends DialogBase {
  readonly dialogTitle = 'Summary Statistics';
  private readonly languageService = inject(LanguageService);

  // Column selection
  selectedColumns: string[] = [];
  groupByColumn = '';

  // Summary options
  summaryMode = signal<SummaryMode>('default');
  selectedStatistics = signal<SummaryStatistic[]>(['n', 'mean', 'sd', 'min', 'max']);
  omitMissing = signal(true);

  // Summary mode options
  summaryModes: SummaryModeOption[] = [
    { value: 'default', labelKey: 'SUMMARY.MODE_DEFAULT', descriptionKey: 'SUMMARY.MODE_DEFAULT_DESC' },
    { value: 'skim', labelKey: 'SUMMARY.MODE_SKIM', descriptionKey: 'SUMMARY.MODE_SKIM_DESC' },
    { value: 'customised', labelKey: 'SUMMARY.MODE_CUSTOM', descriptionKey: 'SUMMARY.MODE_CUSTOM_DESC' },
  ];

  // Available statistics for customised mode
  statisticOptions: StatisticOption[] = [
    { value: 'n', labelKey: 'SUMMARY.STAT_N' },
    { value: 'mean', labelKey: 'SUMMARY.STAT_MEAN' },
    { value: 'sd', labelKey: 'SUMMARY.STAT_SD' },
    { value: 'min', labelKey: 'SUMMARY.STAT_MIN' },
    { value: 'max', labelKey: 'SUMMARY.STAT_MAX' },
    { value: 'median', labelKey: 'SUMMARY.STAT_MEDIAN' },
    { value: 'sum', labelKey: 'SUMMARY.STAT_SUM' },
    { value: 'var', labelKey: 'SUMMARY.STAT_VAR' },
    { value: 'iqr', labelKey: 'SUMMARY.STAT_IQR' },
  ];

  toggleStatistic(stat: SummaryStatistic): void {
    const current = this.selectedStatistics();
    const index = current.indexOf(stat);
    if (index === -1) {
      this.selectedStatistics.set([...current, stat]);
    } else {
      this.selectedStatistics.set(current.filter(s => s !== stat));
    }
  }

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) {
      return '# Select a dataframe first';
    }

    // Use all columns if none selected
    const cols = this.selectedColumns.length > 0 
      ? this.selectedColumns 
      : this.columns().map(c => c.name);

    if (cols.length === 0) {
      return '# No columns available';
    }

    return buildSummaryCode({
      dataframe: df,
      columns: cols,
      mode: this.summaryMode(),
      statistics: this.selectedStatistics(),
      omitMissing: this.omitMissing(),
      groupBy: this.groupByColumn || undefined,
    });
  }

  isValid(): boolean {
    const hasDataframe = !!this.selectedDataframe();
    const hasColumns = this.selectedColumns.length > 0 || this.columns().length > 0;
    const hasStatistics = this.summaryMode() !== 'customised' || this.selectedStatistics().length > 0;
    return hasDataframe && hasColumns && hasStatistics;
  }

  protected override onDataframeChanged(): void {
    // Clear selections when dataframe changes
    this.selectedColumns = [];
    this.groupByColumn = '';
  }

  protected override getCurrentDefaults(): Record<string, unknown> {
    return {
      summaryMode: this.summaryMode(),
      selectedStatistics: this.selectedStatistics(),
      omitMissing: this.omitMissing(),
    };
  }

  protected override applyDefaults(defaults: Record<string, unknown>): void {
    if (defaults['summaryMode']) {
      this.summaryMode.set(defaults['summaryMode'] as SummaryMode);
    }
    if (defaults['selectedStatistics']) {
      this.selectedStatistics.set(defaults['selectedStatistics'] as SummaryStatistic[]);
    }
    if (defaults['omitMissing'] !== undefined) {
      this.omitMissing.set(defaults['omitMissing'] as boolean);
    }
  }
}
