import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-regression-dialog',
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

        <!-- Response Variable -->
        <div class="form-group">
          <label class="form-label">Response Variable (Y)</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [(selectedColumn)]="responseVar"
          />
        </div>

        <!-- Predictor Variables -->
        <div class="form-group">
          <label class="form-label">Predictor Variables (X)</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="true"
            [(selectedColumns)]="predictorVars"
          />
        </div>

        <!-- Model Name -->
        <div class="form-group">
          <label class="form-label">Model Name</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="e.g., my_model"
            [(ngModel)]="modelName"
          />
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="showSummary" />
            <span>Show model summary</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="showAnova" />
            <span>Show ANOVA table</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [(ngModel)]="plotDiagnostics" />
            <span>Plot diagnostics</span>
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
export class RegressionDialogComponent extends DialogBase {
  readonly dialogTitle = 'Linear Regression';

  responseVar = '';
  predictorVars: string[] = [];
  modelName = 'model';
  showSummary = true;
  showAnova = false;
  plotDiagnostics = false;

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.responseVar) return '# Select a response variable';
    
    const name = this.modelName || 'model';
    
    if (this.predictorVars.length === 0) {
      return '# Select at least one predictor variable';
    }

    const formula = `${this.responseVar} ~ ${this.predictorVars.join(' + ')}`;

    let code = `# Linear Regression
${name} <- lm(${formula}, data = get_dataframe("${df}"))`;

    if (this.showSummary) {
      code += `

# Model Summary
summary(${name})`;
    }

    if (this.showAnova) {
      code += `

# ANOVA Table
anova(${name})`;
    }

    if (this.plotDiagnostics) {
      code += `

# Diagnostic Plots
par(mfrow = c(2, 2))
plot(${name})
par(mfrow = c(1, 1))`;
    }

    return code;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && 
      !!this.responseVar && 
      this.predictorVars.length > 0;
  }
}
