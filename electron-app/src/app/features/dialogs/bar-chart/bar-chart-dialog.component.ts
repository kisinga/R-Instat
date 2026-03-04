import { Component, OnInit, signal } from '@angular/core';
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
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="selectedDataframe()" (ngModelChange)="onDataframeChange($event)">
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.TYPE' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="chartType()" (ngModelChange)="chartType.set($event)">
            <option value="frequency">{{ 'BAR_CHART.TYPE_FREQUENCY' | translate }}</option>
            <option value="value">{{ 'BAR_CHART.TYPE_VALUE' | translate }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.X_VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getFactorColumns()"
            [multiple]="false"
            [selectedColumn]="xVariable()"
            (selectedColumnChange)="xVariable.set($event)"
          />
        </div>

        @if (chartType() === 'value') {
          <div class="form-group">
            <label class="form-label">{{ 'BAR_CHART.Y_VARIABLE' | translate }}</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="false"
              [selectedColumn]="yVariable()"
              (selectedColumnChange)="yVariable.set($event)"
            />
          </div>
        }

        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.FILL_BY' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="fillVariable()" (ngModelChange)="fillVariable.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        @if (fillVariable()) {
          <div class="form-group">
            <label class="form-label">{{ 'BAR_CHART.POSITION' | translate }}</label>
            <select class="select select-bordered w-full" [ngModel]="position()" (ngModelChange)="position.set($event)">
              <option value="stack">{{ 'BAR_CHART.POSITION_STACK' | translate }}</option>
              <option value="dodge">{{ 'BAR_CHART.POSITION_DODGE' | translate }}</option>
              <option value="fill">{{ 'BAR_CHART.POSITION_FILL' | translate }}</option>
            </select>
          </div>
        }

        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="horizontal()" (ngModelChange)="horizontal.set($event)" />
            <span>{{ 'BAR_CHART.HORIZONTAL_BARS' | translate }}</span>
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.PLOT_TITLE' | translate }}</label>
          <input
            class="input input-bordered w-full"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
            [placeholder]="'BAR_CHART.PLOT_TITLE_PLACEHOLDER' | translate"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ 'BAR_CHART.OUTPUT_NAME' | translate }}</label>
          <input
            class="input input-bordered w-full"
            [ngModel]="outputName()"
            (ngModelChange)="outputName.set($event)"
            [placeholder]="'BAR_CHART.OUTPUT_NAME_PLACEHOLDER' | translate"
          />
        </div>

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
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
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
  static dialogId = 'bar-chart';
  readonly dialogTitle = 'Bar Chart';

  chartType = signal<'frequency' | 'value'>('frequency');
  xVariable = signal('');
  yVariable = signal('');
  fillVariable = signal('');
  position = signal<'stack' | 'dodge' | 'fill'>('stack');
  horizontal = signal(false);
  title = signal('');
  outputName = signal('');

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      chartType: this.chartType,
      xVariable: this.xVariable,
      yVariable: this.yVariable,
      fillVariable: this.fillVariable,
      position: this.position,
      horizontal: this.horizontal,
      title: this.title,
      outputName: this.outputName,
    });

    this.initializeCodeManager(() => {
      if (this.chartType() === 'value') {
        return buildBarChart({
          type: 'value',
          dataframe: this.selectedDataframe(),
          xVariable: this.xVariable(),
          yVariable: this.yVariable(),
          fillVariable: this.fillVariable() || undefined,
          position: this.position(),
          horizontal: this.horizontal(),
          title: this.title().trim() || undefined,
          name: this.outputName().trim() || undefined,
        });
      }

      return buildBarChart({
        type: 'frequency',
        dataframe: this.selectedDataframe(),
        xVariable: this.xVariable(),
        fillVariable: this.fillVariable() || undefined,
        position: this.position(),
        horizontal: this.horizontal(),
        title: this.title().trim() || undefined,
        name: this.outputName().trim() || undefined,
      });
    });

    this.createRebuildEffect(() => {
      this.chartType();
      this.selectedDataframe();
      this.xVariable();
      this.yVariable();
      this.fillVariable();
      this.position();
      this.horizontal();
      this.title();
      this.outputName();
    });
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.xVariable()) {
      return false;
    }
    if (this.chartType() === 'value' && !this.yVariable()) {
      return false;
    }
    return true;
  }

  protected override onDataframeChanged(): void {
    const availableColumns = new Set(this.columns().map((col) => col.name));

    if (this.xVariable() && !availableColumns.has(this.xVariable())) {
      this.xVariable.set('');
    }
    if (this.yVariable() && !availableColumns.has(this.yVariable())) {
      this.yVariable.set('');
    }
    if (this.fillVariable() && !availableColumns.has(this.fillVariable())) {
      this.fillVariable.set('');
    }
  }
}
