import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-bar-chart-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'BAR_CHART.TITLE' | translate }}</h2>
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

        <!-- X Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.X_VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getFactorColumns()"
            [multiple]="false"
            [(selectedColumn)]="xVariable"
          />
        </div>

        <!-- Fill Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.FILL_BY' | translate }}</label>
          <select class="select select-bordered w-full" [(ngModel)]="fillVariable">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Position -->
        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.POSITION' | translate }}</label>
          <select class="select select-bordered w-full" [(ngModel)]="position">
            <option value="stack">{{ 'BAR_CHART.POSITION_STACK' | translate }}</option>
            <option value="dodge">{{ 'BAR_CHART.POSITION_DODGE' | translate }}</option>
            <option value="fill">{{ 'BAR_CHART.POSITION_FILL' | translate }}</option>
          </select>
        </div>

        <!-- Orientation -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="horizontal" />
            <span>{{ 'BAR_CHART.SHOW_LABELS' | translate }}</span>
          </label>
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
export class BarChartDialogComponent extends DialogBase {
  readonly dialogTitle = 'Bar Chart';

  xVariable = '';
  fillVariable = '';
  position = 'stack';
  horizontal = false;

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.xVariable) return '# Select an X variable';
    
    let aesArgs = `x = ${this.xVariable}`;
    if (this.fillVariable) {
      aesArgs += `, fill = ${this.fillVariable}`;
    }

    let code = `ggplot(get_dataframe("${df}"), aes(${aesArgs})) +
  geom_bar(position = "${this.position}", alpha = 0.8)`;

    if (this.horizontal) {
      code += ` +
  coord_flip()`;
    }

    code += ` +
  theme_minimal() +
  labs(title = "Bar Chart of ${this.xVariable}", x = "${this.xVariable}", y = "Count")`;

    return code;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.xVariable;
  }
}
