import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildBarChart } from '../../../core/dialogs/builders/barchart';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-bar-chart-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, TranslateModule, CodePreviewComponent],
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

        <app-column-selector [columns]="columns()">
          <app-column-slot name="xVariable" [label]="'BAR_CHART.X_VARIABLE' | translate"
            filter="factor" [required]="true"
            [(column)]="xVariable" />
          @if (chartType() === 'value') {
            <app-column-slot name="yVariable" [label]="'BAR_CHART.Y_VARIABLE' | translate"
              filter="numeric" [required]="true"
              [(column)]="yVariable" />
          }
          <app-column-slot name="fillVariable" [label]="'BAR_CHART.FILL_BY' | translate"
            filter="factor"
            [(column)]="fillVariable" />
        </app-column-selector>

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
  static { AIDialogClassRegistry.register(BarChartDialogComponent); }
  static dialogId = 'bar-chart';

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'bar-chart',
      componentType: 'BarChartDialogComponent',
      title: 'Bar Chart',
      family: 'plotting',
      description: 'Bar chart for categorical counts or numeric values by category.',
      operations: ['describe.distribution.numeric', 'describe.comparison.numeric_by_group'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('chartType', 'enum', { required: true, enumValues: ['frequency', 'value'] }),
        p('xVariable', 'column', { required: true, filter: 'factor' }),
        p('yVariable', 'column', { required: true, filter: 'numeric', when: { param: 'chartType', equals: 'value' } }),
        p('fillVariable', 'column', { filter: 'factor' }),
        p('position', 'enum', { enumValues: ['stack', 'dodge', 'fill'] }),
        p('horizontal', 'boolean'),
        p('title', 'string'),
        p('outputName', 'string'),
      ],
      retrievalHints: {
        keywords: ['bar', 'bars', 'count', 'category', 'frequency', 'group', 'comparison'],
      },
    };
  }

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
