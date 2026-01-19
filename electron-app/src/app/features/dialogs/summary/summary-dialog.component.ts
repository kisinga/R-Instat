import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-summary-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">Data Frame</label>
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
          <label class="form-label">Columns (leave empty for all)</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="true"
            [(selectedColumns)]="selectedCols"
          />
        </div>

        <!-- Summary Type -->
        <div class="form-group">
          <label class="form-label">Summary Type</label>
          <div class="flex flex-wrap gap-2">
            @for (type of summaryTypes; track type.value) {
              <label class="label cursor-pointer gap-2 bg-base-200 rounded-lg px-3 py-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary"
                  [checked]="selectedTypes.includes(type.value)"
                  (change)="toggleType(type.value)"
                />
                <span class="text-sm">{{ type.label }}</span>
              </label>
            }
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class SummaryDialogComponent extends DialogBase {
  readonly dialogTitle = 'Summary Statistics';

  selectedCols: string[] = [];
  selectedTypes: string[] = ['mean', 'sd', 'min', 'max'];

  summaryTypes = [
    { value: 'n', label: 'Count' },
    { value: 'mean', label: 'Mean' },
    { value: 'sd', label: 'Std Dev' },
    { value: 'min', label: 'Min' },
    { value: 'max', label: 'Max' },
    { value: 'median', label: 'Median' },
    { value: 'sum', label: 'Sum' },
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
