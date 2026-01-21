import { Component, computed, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildBarChart } from '../../../core/dialogs/builders/barchart';

@Component({
  selector: 'app-bar-chart-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule, CodePreviewComponent],
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
            [selectedColumn]="xVariable()"
            (selectedColumnChange)="xVariable.set($event)"
          />
        </div>

        <!-- Fill Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.FILL_BY' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="fillVariable()" (ngModelChange)="fillVariable.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Position -->
        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.POSITION' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="position()" (ngModelChange)="position.set($event)">
            <option value="stack">{{ 'BAR_CHART.POSITION_STACK' | translate }}</option>
            <option value="dodge">{{ 'BAR_CHART.POSITION_DODGE' | translate }}</option>
            <option value="fill">{{ 'BAR_CHART.POSITION_FILL' | translate }}</option>
          </select>
        </div>

        <!-- Orientation -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="horizontal()" (ngModelChange)="horizontal.set($event)" />
            <span>{{ 'BAR_CHART.SHOW_LABELS' | translate }}</span>
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
export class BarChartDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Bar Chart';

  // Dialog state using signals for reactivity
  xVariable = signal('');
  fillVariable = signal('');
  position = signal<'stack' | 'dodge' | 'fill'>('stack');
  horizontal = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      xVariable: this.xVariable,
      fillVariable: this.fillVariable,
      position: this.position,
      horizontal: this.horizontal,
    });

    // Initialize code manager with builder function
    // The builder will be called whenever rebuild() is invoked
    this.initializeCodeManager(() =>
      buildBarChart({
        type: 'frequency', // Frequency bar chart (counts occurrences)
        dataframe: this.selectedDataframe(),
        xVariable: this.xVariable(),
        fillVariable: this.fillVariable() || undefined,
        position: this.position(),
        horizontal: this.horizontal(),
        title: `Bar Chart of ${this.xVariable()}`,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    // This must be after initializeCodeManager so the builder is set
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.xVariable();
      this.fillVariable();
      this.position();
      this.horizontal();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }


  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.xVariable();
  }
}
