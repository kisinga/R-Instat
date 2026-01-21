import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { buildBoxplot } from '../../../core/dialogs/builders/graphs';

@Component({
  selector: 'app-boxplot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'BOXPLOT.TITLE' | translate }}</h2>
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

        <!-- Y Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'BOXPLOT.Y_VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [selectedColumn]="yVariable()"
            (selectedColumnChange)="yVariable.set($event)"
          />
        </div>

        <!-- X Variable (grouping) -->
        <div class="form-group">
          <label class="form-label">{{ 'BOXPLOT.X_VARIABLE' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="xVariable()" (ngModelChange)="xVariable.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Fill Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'BOXPLOT.FILL_BY' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="fillVariable()" (ngModelChange)="fillVariable.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="showPoints()" (ngModelChange)="showPoints.set($event)" />
            <span>{{ 'BOXPLOT.SHOW_POINTS' | translate }}</span>
          </label>
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
export class BoxplotDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Box Plot';

  // Dialog state using signals for reactivity
  yVariable = signal('');
  xVariable = signal('');
  fillVariable = signal('');
  showPoints = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildBoxplot({
        dataframe: this.selectedDataframe(),
        yVariable: this.yVariable(),
        xVariable: this.xVariable() || undefined,
        fillVariable: this.fillVariable() || undefined,
        showPoints: this.showPoints(),
        title: `Box Plot of ${this.yVariable()}`,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.yVariable();
      this.xVariable();
      this.fillVariable();
      this.showPoints();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.yVariable();
  }
}
