import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildHistogram } from '../../../core/dialogs/builders/graphs';
import type { DialogPromptContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-histogram-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule, CodePreviewComponent],
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
            [selectedColumn]="variable()"
            (selectedColumnChange)="variable.set($event)"
          />
        </div>

        <!-- Options -->
        <div class="grid grid-cols-2 gap-4">
          <div class="form-group">
            <label class="form-label">{{ 'HISTOGRAM.BINS' | translate }}</label>
            <input
              type="number"
              class="input input-bordered w-full"
              [ngModel]="bins()"
              (ngModelChange)="bins.set($event)"
              min="5"
              max="100"
            />
          </div>

          <div class="form-group">
            <label class="form-label">{{ 'HISTOGRAM.FILL_COLOR' | translate }}</label>
            <input
              type="color"
              class="w-full h-10 rounded cursor-pointer"
              [ngModel]="fillColor()"
              (ngModelChange)="fillColor.set($event)"
            />
          </div>
        </div>

        <!-- Facet Option -->
        <div class="form-group">
          <label class="form-label">{{ 'HISTOGRAM.FACET_BY' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="facetBy()" (ngModelChange)="facetBy.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'HISTOGRAM.PLOT_TITLE' | translate }}</label>
          <input
            class="input input-bordered w-full"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
            [placeholder]="'HISTOGRAM.PLOT_TITLE_PLACEHOLDER' | translate"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'HISTOGRAM.OUTPUT_NAME' | translate }}</label>
          <input
            class="input input-bordered w-full"
            [ngModel]="outputName()"
            (ngModelChange)="outputName.set($event)"
            [placeholder]="'HISTOGRAM.OUTPUT_NAME_PLACEHOLDER' | translate"
          />
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
export class HistogramDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(HistogramDialogComponent); }
  static dialogId = 'histogram';
  readonly dialogTitle = 'Histogram';

  static override getCatalogDescriptor(): DialogPromptContract {
    return {
      dialogId: 'histogram',
      componentType: 'HistogramDialogComponent',
      family: 'plotting',
      description: 'Histogram of numeric variable.',
      operations: ['describe.distribution.numeric'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('variable', 'column', { required: true, columnType: 'numeric' }),
        p('bins', 'number', { min: 5, max: 100 }),
        p('fillColor', 'string'),
        p('facetBy', 'column', { columnType: 'factor' }),
        p('title', 'string'),
        p('outputName', 'string'),
      ],
      retrievalHints: {
        keywords: ['histogram', 'distribution', 'numeric', 'bins', 'frequency'],
      },
    };
  }

  // Dialog state using signals for reactivity
  variable = signal('');
  bins = signal(30);
  fillColor = signal('#6366f1');
  facetBy = signal('');
  title = signal('');
  outputName = signal('');

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      variable: this.variable,
      bins: this.bins,
      fillColor: this.fillColor,
      facetBy: this.facetBy,
      title: this.title,
      outputName: this.outputName,
    });

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildHistogram({
        dataframe: this.selectedDataframe(),
        variable: this.variable(),
        bins: this.bins(),
        fillColor: this.fillColor(),
        facetBy: this.facetBy() || undefined,
        title: this.title().trim() || undefined,
        name: this.outputName().trim() || undefined,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createRebuildEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.variable();
      this.bins();
      this.fillColor();
      this.facetBy();
      this.title();
      this.outputName();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.variable() && this.bins() >= 5 && this.bins() <= 100;
  }
}
