import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-histogram-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'HISTOGRAM.TITLE' | translate }}</h2>
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

        <!-- Variable Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'HISTOGRAM.VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [(selectedColumn)]="variable"
          />
        </div>

        <!-- Options -->
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">{{ 'HISTOGRAM.BINS' | translate }}</label>
            <input
              type="number"
              class="input input-bordered w-full"
              [(ngModel)]="bins"
              min="5"
              max="100"
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ 'HISTOGRAM.FILL_COLOR' | translate }}</label>
            <input
              type="color"
              class="w-full h-10 rounded cursor-pointer"
              [(ngModel)]="fillColor"
            />
          </div>
        </div>

        <!-- Facet Option -->
        <div class="form-group">
          <label class="form-label">{{ 'HISTOGRAM.FACET_BY' | translate }}</label>
          <select class="select select-bordered w-full" [(ngModel)]="facetBy">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
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
export class HistogramDialogComponent extends DialogBase {
  readonly dialogTitle = 'Histogram';

  variable = '';
  bins = 30;
  fillColor = '#6366f1';
  facetBy = '';

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.variable) return '# Select a variable first';
    
    let code = `ggplot(get_dataframe("${df}"), aes(x = ${this.variable})) +
  geom_histogram(bins = ${this.bins}, fill = "${this.fillColor}", color = "white", alpha = 0.8) +
  theme_minimal() +
  labs(title = "Histogram of ${this.variable}", x = "${this.variable}", y = "Count")`;

    if (this.facetBy) {
      code += ` +
  facet_wrap(~ ${this.facetBy})`;
    }

    return code;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.variable;
  }
}
