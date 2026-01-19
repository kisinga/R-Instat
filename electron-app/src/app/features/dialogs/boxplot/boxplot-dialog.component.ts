import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-boxplot-dialog',
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

        <!-- Y Variable -->
        <div class="form-group">
          <label class="form-label">Y Variable (numeric)</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [(selectedColumn)]="yVariable"
          />
        </div>

        <!-- X Variable (grouping) -->
        <div class="form-group">
          <label class="form-label">X Variable / Group By (optional)</label>
          <select class="select select-bordered w-full" [(ngModel)]="xVariable">
            <option value="">None</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Fill Variable -->
        <div class="form-group">
          <label class="form-label">Fill Color By (optional)</label>
          <select class="select select-bordered w-full" [(ngModel)]="fillVariable">
            <option value="">None</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="showPoints" />
            <span>Show data points (jitter)</span>
          </label>
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
export class BoxplotDialogComponent extends DialogBase {
  readonly dialogTitle = 'Box Plot';

  yVariable = '';
  xVariable = '';
  fillVariable = '';
  showPoints = false;

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.yVariable) return '# Select a Y variable';
    
    // Build aes string
    let aesArgs = `y = ${this.yVariable}`;
    if (this.xVariable) {
      aesArgs = `x = ${this.xVariable}, ${aesArgs}`;
    }
    if (this.fillVariable) {
      aesArgs += `, fill = ${this.fillVariable}`;
    }

    let code = `ggplot(get_dataframe("${df}"), aes(${aesArgs})) +
  geom_boxplot(alpha = 0.7)`;

    if (this.showPoints) {
      code += ` +
  geom_jitter(width = 0.2, alpha = 0.5, size = 1)`;
    }

    code += ` +
  theme_minimal() +
  labs(title = "Box Plot of ${this.yVariable}"${this.xVariable ? `, x = "${this.xVariable}"` : ''}, y = "${this.yVariable}")`;

    return code;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.yVariable;
  }
}
