import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildScatter } from '../../../core/dialogs/builders/graphs';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-scatter-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, TranslateModule, CodePreviewComponent],
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

        <app-column-selector [columns]="columns()" [excludeUsed]="true">
          <app-column-slot name="xVariable" [label]="'SCATTER.X_VARIABLE' | translate"
            filter="numeric" [required]="true"
            [(column)]="xVariable" />
          <app-column-slot name="yVariable" [label]="'SCATTER.Y_VARIABLE' | translate"
            filter="numeric" [required]="true"
            [(column)]="yVariable" />
          <app-column-slot name="colorVariable" [label]="'SCATTER.COLOR_BY' | translate"
            filter="factor"
            [(column)]="colorVariable" />
        </app-column-selector>

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

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'scatter',
      componentType: 'ScatterDialogComponent',
      title: 'Scatter Plot',
      family: 'plotting',
      description: 'Scatter plot of two numeric variables.',
      operations: ['describe.association.numeric_numeric'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('xVariable', 'column', { required: true, filter: 'numeric' }),
        p('yVariable', 'column', { required: true, filter: 'numeric' }),
        p('colorVariable', 'column', { filter: 'factor' }),
        p('addTrendLine', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['scatter', 'scatter plot', 'x y', 'two numeric', 'relationship'],
      },
    };
  }

  xVariable = signal('');
  yVariable = signal('');
  colorVariable = signal('');
  addTrendLine = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      xVariable: this.xVariable,
      yVariable: this.yVariable,
      colorVariable: this.colorVariable,
      addTrendLine: this.addTrendLine,
    });

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

    this.createEffect(() => {
      this.selectedDataframe();
      this.xVariable();
      this.yVariable();
      this.colorVariable();
      this.addTrendLine();
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.xVariable() && !!this.yVariable();
  }
}
