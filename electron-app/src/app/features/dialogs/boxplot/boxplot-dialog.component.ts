import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildBoxplot } from '../../../core/dialogs/builders/graphs';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-boxplot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, TranslateModule, CodePreviewComponent],
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

        <app-column-selector [columns]="columns()">
          <app-column-slot name="yVariable" [label]="'BOXPLOT.Y_VARIABLE' | translate"
            filter="numeric" [required]="true"
            [(column)]="yVariable" />
          <app-column-slot name="xVariable" [label]="'BOXPLOT.X_VARIABLE' | translate"
            filter="factor"
            [(column)]="xVariable" />
          <app-column-slot name="fillVariable" [label]="'BOXPLOT.FILL_BY' | translate"
            filter="factor"
            [(column)]="fillVariable" />
        </app-column-selector>

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
export class BoxplotDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(BoxplotDialogComponent); }
  static readonly dialogId = 'boxplot';

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'boxplot',
      componentType: 'BoxplotDialogComponent',
      title: 'Box Plot',
      family: 'plotting',
      description: 'Boxplot comparing numeric variable across groups.',
      operations: ['describe.comparison.numeric_by_group'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('yVariable', 'column', { required: true, filter: 'numeric' }),
        p('xVariable', 'column', { filter: 'factor' }),
        p('fillVariable', 'column', { filter: 'factor' }),
        p('showPoints', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['boxplot', 'box plot', 'distribution', 'quartile', 'outlier'],
      },
    };
  }

  yVariable = signal('');
  xVariable = signal('');
  fillVariable = signal('');
  showPoints = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      yVariable: this.yVariable,
      xVariable: this.xVariable,
      fillVariable: this.fillVariable,
      showPoints: this.showPoints,
    });

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

    this.createEffect(() => {
      this.selectedDataframe();
      this.yVariable();
      this.xVariable();
      this.fillVariable();
      this.showPoints();
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && !!this.yVariable();
  }
}
