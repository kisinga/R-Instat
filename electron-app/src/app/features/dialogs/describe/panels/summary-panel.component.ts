/**
 * Summary Panel Component
 * 
 * Panel for configuring summary statistics output.
 * Supports Default, Customised, and Skim modes.
 */

import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColumnInfo } from '../../../../core/models/r.model';
import { DescribeDialogService } from '../describe-dialog.service';
import { SummaryStatistic, SummaryMode } from '../utils/r-code-builders';

interface StatisticOption {
  value: SummaryStatistic;
  label: string;
  description: string;
}

@Component({
  selector: 'app-summary-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="summary-panel">
      <!-- Summary Mode Selection -->
      <div class="form-group">
        <label class="form-label">Summary Type</label>
        <div class="flex gap-2">
          @for (mode of summaryModes; track mode.value) {
            <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-3 py-2 flex-1">
              <input 
                type="radio" 
                class="radio radio-sm radio-primary"
                [value]="mode.value"
                [checked]="service.summaryMode() === mode.value"
                (change)="service.setSummaryMode(mode.value)"
              />
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ mode.label }}</span>
                <span class="text-xs text-base-content/60">{{ mode.description }}</span>
              </div>
            </label>
          }
        </div>
      </div>

      <!-- Customised Statistics Selection (only for customised mode) -->
      @if (service.summaryMode() === 'customised') {
        <div class="form-group">
          <label class="form-label">Statistics to Include</label>
          <div class="grid grid-cols-3 gap-2">
            @for (stat of statisticOptions; track stat.value) {
              <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-3 py-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary"
                  [checked]="service.summaryStatistics().includes(stat.value)"
                  (change)="service.toggleSummaryStatistic(stat.value)"
                />
                <div class="flex flex-col flex-1">
                  <span class="text-sm">{{ stat.label }}</span>
                  <span class="text-xs text-base-content/50">{{ stat.description }}</span>
                </div>
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
              [checked]="service.omitMissing()"
              (change)="service.setOmitMissing($any($event.target).checked)"
            />
            <span class="text-sm">Omit missing values (na.rm = TRUE)</span>
          </label>
        </div>

        <!-- Group By (optional) -->
        @if (factorColumns.length > 0) {
          <div class="form-group">
            <label class="form-label">Group By (optional)</label>
            <select 
              class="select select-bordered select-sm w-full"
              [ngModel]="service.groupBy()"
              (ngModelChange)="service.setGroupBy($event)"
            >
              <option value="">No grouping</option>
              @for (col of factorColumns; track col.name) {
                <option [value]="col.name">{{ col.name }}</option>
              }
            </select>
          </div>
        }
      }

      <!-- Info for other modes -->
      @if (service.summaryMode() === 'default') {
        <div class="info-box">
          <p class="text-sm text-base-content/70">
            Uses R's built-in <code>summary()</code> function. 
            For numeric variables: min, 1st quartile, median, mean, 3rd quartile, max.
            For factors: frequency counts.
          </p>
        </div>
      }

      @if (service.summaryMode() === 'skim') {
        <div class="info-box">
          <p class="text-sm text-base-content/70">
            Uses <code>skimr::skim()</code> for comprehensive summaries.
            Includes histograms, missing values, and type-specific statistics.
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    .summary-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .info-box {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
    }

    code {
      background: hsl(var(--b3));
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.8em;
    }
  `],
})
export class SummaryPanelComponent {
  @Input() columns: ColumnInfo[] = [];
  @Input() factorColumns: ColumnInfo[] = [];

  readonly service = inject(DescribeDialogService);

  readonly summaryModes: { value: SummaryMode; label: string; description: string }[] = [
    { value: 'default', label: 'Default', description: 'R summary()' },
    { value: 'customised', label: 'Customised', description: 'Pick statistics' },
    { value: 'skim', label: 'Skim', description: 'Comprehensive' },
  ];

  readonly statisticOptions: StatisticOption[] = [
    { value: 'n', label: 'Count', description: 'n' },
    { value: 'mean', label: 'Mean', description: 'Average' },
    { value: 'sd', label: 'Std Dev', description: 'Standard deviation' },
    { value: 'min', label: 'Min', description: 'Minimum' },
    { value: 'max', label: 'Max', description: 'Maximum' },
    { value: 'median', label: 'Median', description: '50th percentile' },
    { value: 'sum', label: 'Sum', description: 'Total' },
    { value: 'var', label: 'Variance', description: 'Variance' },
    { value: 'iqr', label: 'IQR', description: 'Interquartile range' },
  ];
}
