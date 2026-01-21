import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { buildRegression } from '../../../core/dialogs/builders/statistics';

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
            [selectedColumn]="responseVar()"
            (selectedColumnChange)="responseVar.set($event)"
          />
        </div>

        <!-- Predictor Variables -->
        <div class="form-group">
          <label class="form-label">Predictor Variables (X)</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="true"
            [(selectedColumns)]="predictorVarsArray"
          />
        </div>

        <!-- Model Name -->
        <div class="form-group">
          <label class="form-label">Model Name</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="e.g., my_model"
            [ngModel]="modelName()"
            (ngModelChange)="modelName.set($event)"
          />
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="showSummary()" (ngModelChange)="showSummary.set($event)" />
            <span>Show model summary</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="showAnova()" (ngModelChange)="showAnova.set($event)" />
            <span>Show ANOVA table</span>
          </label>
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="plotDiagnostics()" (ngModelChange)="plotDiagnostics.set($event)" />
            <span>Plot diagnostics</span>
          </label>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ rCode() }}</pre>
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
export class RegressionDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Linear Regression';

  responseVar = signal('');
  predictorVars = signal<string[]>([]);
  modelName = signal('model');
  showSummary = signal(true);
  showAnova = signal(false);
  plotDiagnostics = signal(false);

  // Getter/setter for ColumnPickerComponent two-way binding
  get predictorVarsArray(): string[] {
    return this.predictorVars();
  }

  set predictorVarsArray(value: string[]) {
    this.predictorVars.set(value);
  }

  override ngOnInit(): void {
    super.ngOnInit();

    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return buildRegression({
          dataframe: '',
          responseVar: '',
          predictorVars: [],
        });
      }

      return buildRegression({
        dataframe: df,
        responseVar: this.responseVar(),
        predictorVars: this.predictorVars(),
        modelName: this.modelName(),
        showSummary: this.showSummary(),
        showAnova: this.showAnova(),
        plotDiagnostics: this.plotDiagnostics(),
      });
    });

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.responseVar();
      this.predictorVars();
      this.modelName();
      this.showSummary();
      this.showAnova();
      this.plotDiagnostics();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && 
      !!this.responseVar() && 
      this.predictorVars().length > 0;
  }
}
