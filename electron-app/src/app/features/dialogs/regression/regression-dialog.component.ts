import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildRegression } from '../../../core/dialogs/builders/statistics';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-regression-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, CodePreviewComponent],
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
        <app-column-selector [columns]="columns()">
          <app-column-slot name="responseVar" [label]="'Response Variable (Y)'"
            filter="numeric" [required]="true"
            [(column)]="responseVar" />
          <app-column-slot name="predictorVars" [label]="'Predictor Variables (X)'"
            [multiple]="true" [required]="true"
            [columns]="predictorVars()" (columnsChange)="predictorVars.set($event)" />
        </app-column-selector>

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
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
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
  static { AIDialogClassRegistry.register(RegressionDialogComponent); }
  static readonly dialogId = 'regression';

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'regression',
      componentType: 'RegressionDialogComponent',
      title: 'Linear Regression',
      family: 'predictive',
      description: 'Linear regression with one response and predictors.',
      operations: ['predictive.linear_regression'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('responseVar', 'column', { required: true, filter: 'numeric' }),
        p('predictorVars', 'column[]', { required: true, filter: 'any' }),
        p('modelName', 'string'),
        p('showSummary', 'boolean'),
        p('showAnova', 'boolean'),
        p('plotDiagnostics', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['regression', 'linear model', 'predictor', 'lm', 'linear'],
      },
    };
  }

  responseVar = signal('');
  predictorVars = signal<string[]>([]);
  modelName = signal('model');
  showSummary = signal(true);
  showAnova = signal(false);
  plotDiagnostics = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      responseVar: this.responseVar,
      predictorVars: this.predictorVars,
      modelName: this.modelName,
      showSummary: this.showSummary,
      showAnova: this.showAnova,
      plotDiagnostics: this.plotDiagnostics,
    });

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
