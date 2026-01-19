import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { LanguageService } from '../../../core/services/language.service';

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
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          <select 
            class="select select-bordered w-full"
            [ngModel]="selectedDataframe()"
            (ngModelChange)="onDataframeChange($event)"
          >
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <!-- Column Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'SUMMARY.COLUMNS_HINT' | translate }}</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="true"
            [(selectedColumns)]="selectedCols"
          />
        </div>

        <!-- Summary Type -->
        <div class="form-group">
          <label class="form-label">{{ 'SUMMARY.TYPE' | translate }}</label>
          <div class="flex flex-wrap gap-2">
            @for (type of summaryTypes; track type.value) {
              <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-3 py-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary"
                  [checked]="selectedTypes.includes(type.value)"
                  (change)="toggleType(type.value)"
                />
                <span class="text-sm">{{ type.labelKey | translate }}</span>
              </label>
            }
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">{{ 'DIALOG.CODE_PREVIEW' | translate }}</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
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

  selectedCols: string[] = [];
  selectedTypes: string[] = ['mean', 'sd', 'min', 'max'];

  summaryTypes = [
    { value: 'n', labelKey: 'SUMMARY.COUNT' },
    { value: 'mean', labelKey: 'SUMMARY.MEAN' },
    { value: 'sd', labelKey: 'SUMMARY.STD_DEV' },
    { value: 'min', labelKey: 'SUMMARY.MIN' },
    { value: 'max', labelKey: 'SUMMARY.MAX' },
    { value: 'median', labelKey: 'SUMMARY.MEDIAN' },
    { value: 'sum', labelKey: 'SUMMARY.SUM' },
  ];

  toggleType(type: string): void {
    const index = this.selectedTypes.indexOf(type);
    if (index === -1) {
      this.selectedTypes = [...this.selectedTypes, type];
    } else {
      this.selectedTypes = this.selectedTypes.filter(t => t !== type);
    }
  }

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) {
      return '# Select a dataframe first';
    }

    const cols = this.selectedCols.length > 0 
      ? this.selectedCols 
      : this.getNumericColumns().map(c => c.name);
    
    if (cols.length === 0) {
      return `summary(get_dataframe("${df}"))`;
    }

    const colsStr = cols.map(c => `"${c}"`).join(', ');
    
    // Build summary functions for dplyr::across
    const summaryFns = this.selectedTypes.map(t => {
      switch (t) {
        case 'n': return 'n = ~n()';
        case 'mean': return 'mean = ~mean(.x, na.rm = TRUE)';
        case 'sd': return 'sd = ~sd(.x, na.rm = TRUE)';
        case 'min': return 'min = ~min(.x, na.rm = TRUE)';
        case 'max': return 'max = ~max(.x, na.rm = TRUE)';
        case 'median': return 'median = ~median(.x, na.rm = TRUE)';
        case 'sum': return 'sum = ~sum(.x, na.rm = TRUE)';
        default: return '';
      }
    }).filter(Boolean);

    if (summaryFns.length === 0) {
      return '# Select at least one statistic';
    }

    return `get_dataframe("${df}") %>%
  dplyr::select(${colsStr}) %>%
  dplyr::summarise(
    dplyr::across(
      everything(),
      list(${summaryFns.join(', ')})
    )
  ) %>%
  tidyr::pivot_longer(everything(), names_to = "stat", values_to = "value")`;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.selectedTypes.length > 0;
  }
}
