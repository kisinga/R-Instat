import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildScatter } from '../../../core/dialogs/builders/graphs';
import type { DialogPromptContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-scatter-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, TranslateModule, CodePreviewComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'SCATTER.TITLE' | translate }}</h2>
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
          <label class="form-label">{{ 'SCATTER.X_VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [selectedColumn]="xVariable()"
            (selectedColumnChange)="xVariable.set($event)"
          />
        </div>

        <!-- Y Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'SCATTER.Y_VARIABLE' | translate }}</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [selectedColumn]="yVariable()"
            (selectedColumnChange)="yVariable.set($event)"
          />
        </div>

        <!-- Color Variable -->
        <div class="form-group">
          <label class="form-label">{{ 'SCATTER.COLOR_BY' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="colorVariable()" (ngModelChange)="colorVariable.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-primary" [ngModel]="addTrendLine()" (ngModelChange)="addTrendLine.set($event)" />
            <span>{{ 'SCATTER.SHOW_REGRESSION' | translate }}</span>
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
export class ScatterDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(ScatterDialogComponent); }
  static readonly dialogId = 'scatter';
  readonly dialogTitle = 'Scatter Plot';

  static override getCatalogDescriptor(): DialogPromptContract {
    return {
      dialogId: 'scatter',
      componentType: 'ScatterDialogComponent',
      family: 'plotting',
      description: 'Scatter plot of two numeric variables.',
      operations: ['describe.association.numeric_numeric'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('xVariable', 'column', { required: true, columnType: 'numeric' }),
        p('yVariable', 'column', { required: true, columnType: 'numeric' }),
        p('colorVariable', 'column', { columnType: 'factor' }),
        p('addTrendLine', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['scatter', 'scatter plot', 'x y', 'two numeric', 'relationship'],
      },
    };
  }

  // Dialog state using signals for reactivity
  xVariable = signal('');
  yVariable = signal('');
  colorVariable = signal('');
  addTrendLine = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      xVariable: this.xVariable,
      yVariable: this.yVariable,
      colorVariable: this.colorVariable,
      addTrendLine: this.addTrendLine,
    });

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildScatter({
        dataframe: this.selectedDataframe(),
        xVariable: this.xVariable(),
        yVariable: this.yVariable(),
        colorVariable: this.colorVariable() || undefined,
        addTrendLine: this.addTrendLine(),
        title: `${this.yVariable()} vs ${this.xVariable()}`,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.xVariable();
      this.yVariable();
      this.colorVariable();
      this.addTrendLine();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.xVariable() && !!this.yVariable();
  }
}
