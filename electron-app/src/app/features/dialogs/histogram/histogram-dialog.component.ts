import { Component, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { buildHistogram } from '../../../core/dialogs/builders/graphs';

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

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">{{ 'DIALOG.CODE_PREVIEW' | translate }}</label>
            <pre class="code-block">{{ rCode() }}</pre>
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
  readonly dialogTitle = 'Histogram';

  // Dialog state using signals for reactivity
  variable = signal('');
  bins = signal(30);
  fillColor = signal('#6366f1');
  facetBy = signal('');

  override ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildHistogram({
        dataframe: this.selectedDataframe(),
        variable: this.variable(),
        bins: this.bins(),
        fillColor: this.fillColor(),
        facetBy: this.facetBy() || undefined,
        title: `Histogram of ${this.variable()}`,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    effect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.variable();
      this.bins();
      this.fillColor();
      this.facetBy();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.variable();
  }
}
