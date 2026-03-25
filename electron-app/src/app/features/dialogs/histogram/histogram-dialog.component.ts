import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildHistogram } from '../../../core/dialogs/builders/graphs';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-histogram-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, TranslateModule, CodePreviewComponent],
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

        <app-column-selector [columns]="columns()">
          <app-column-slot name="variable" [label]="'HISTOGRAM.VARIABLE' | translate"
            filter="numeric" [required]="true"
            [(column)]="variable" />
          <app-column-slot name="facetBy" [label]="'HISTOGRAM.FACET_BY' | translate"
            filter="factor"
            [(column)]="facetBy" />
        </app-column-selector>

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

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'histogram',
      componentType: 'HistogramDialogComponent',
      title: 'Histogram',
      family: 'plotting',
      description: 'Histogram of numeric variable.',
      operations: ['describe.distribution.numeric'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('variable', 'column', { required: true, filter: 'numeric' }),
        p('bins', 'number', { min: 5, max: 100 }),
        p('fillColor', 'string'),
        p('facetBy', 'column', { filter: 'factor' }),
        p('title', 'string'),
        p('outputName', 'string'),
      ],
      retrievalHints: {
        keywords: ['histogram', 'distribution', 'numeric', 'bins', 'frequency'],
      },
    };
  }

  variable = signal('');
  bins = signal(30);
  fillColor = signal('#6366f1');
  facetBy = signal('');
  title = signal('');
  outputName = signal('');

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      variable: this.variable,
      bins: this.bins,
      fillColor: this.fillColor,
      facetBy: this.facetBy,
      title: this.title,
      outputName: this.outputName,
    });

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

    this.createRebuildEffect(() => {
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
