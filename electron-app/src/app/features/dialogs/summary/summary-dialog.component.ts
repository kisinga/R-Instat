/**
 * Summary Dialog Component
 * 
 * Focused dialog for generating summary statistics.
 * Separated from the Describe dialog for clearer UX.
 */

import { Component, signal, computed, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { LanguageService } from '../../../core/services/language.service';
import { 
  buildSummaryCode, 
  SummaryMode, 
  SummaryStatistic 
} from '../describe/utils/r-code-builders';
import { rSyntax } from '../../../core/r-codegen';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

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
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, TranslateModule, CodePreviewComponent],
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

            <!-- Variables to Summarize & Group By -->
            <app-column-selector [columns]="columns()">
              <div class="form-group">
                <div class="flex items-center gap-2">
                  <span class="text-xs text-base-content/60">({{ selectedColumns().length }}/{{ columns().length }})</span>
                </div>
                <app-column-slot name="selectedColumns" [label]="'SUMMARY.VARIABLES' | translate"
                  [multiple]="true" [required]="true"
                  [columns]="selectedColumns()" (columnsChange)="selectedColumns.set($event)" />
              </div>

              <div class="form-group">
                <app-column-slot name="groupByColumn" [label]="'SUMMARY.GROUP_BY' | translate"
                  filter="factor"
                  [(column)]="groupByColumn" />
                <p class="text-xs text-base-content/50 mt-1">{{ 'SUMMARY.GROUP_BY_HINT' | translate }}</p>
              </div>
            </app-column-selector>
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
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
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
export class SummaryDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(SummaryDialogComponent); }
  static readonly dialogId = 'summary';
  private readonly languageService = inject(LanguageService);

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'summary',
      componentType: 'SummaryDialogComponent',
      title: 'Summary Statistics',
      family: 'plotting',
      description: 'Summary statistics for selected columns.',
      operations: ['describe.comparison.numeric_by_group'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('selectedColumns', 'column[]', { required: true, filter: 'any' }),
        p('groupByColumn', 'column', { filter: 'factor' }),
        p('summaryMode', 'enum', { enumValues: ['default', 'customised', 'skim'] }),
        p('selectedStatistics', 'string[]'),
        p('omitMissing', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['summary', 'statistics', 'describe', 'numeric', 'group'],
      },
    };
  }

  // Column selection
  selectedColumns = signal<string[]>([]);
  groupByColumn = signal('');

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

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      selectedColumns: this.selectedColumns,
      groupByColumn: this.groupByColumn,
      summaryMode: this.summaryMode,
      selectedStatistics: this.selectedStatistics,
      omitMissing: this.omitMissing,
    });

    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return rSyntax().setBase('# Select a dataframe first');
      }

      // Use all columns if none selected
      const cols = this.selectedColumns().length > 0 
        ? this.selectedColumns() 
        : this.columns().map(c => c.name);

      if (cols.length === 0) {
        return rSyntax().setBase('# No columns available');
      }

      const code = buildSummaryCode({
        dataframe: df,
        columns: cols,
        mode: this.summaryMode(),
        statistics: this.selectedStatistics(),
        omitMissing: this.omitMissing(),
        groupBy: this.groupByColumn() || undefined,
      });

      return rSyntax().setBase(code);
    });

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.selectedColumns();
      this.groupByColumn();
      this.summaryMode();
      this.selectedStatistics();
      this.omitMissing();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    const hasDataframe = !!this.selectedDataframe();
    const hasColumns = this.selectedColumns().length > 0 || this.columns().length > 0;
    const hasStatistics = this.summaryMode() !== 'customised' || this.selectedStatistics().length > 0;
    return hasDataframe && hasColumns && hasStatistics;
  }

  protected override onDataframeChanged(): void {
    // Clear selections when dataframe changes
    this.selectedColumns.set([]);
    this.groupByColumn.set('');
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
