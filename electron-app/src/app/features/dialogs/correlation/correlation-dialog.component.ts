import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildCorrelation } from '../../../core/dialogs/builders/statistics';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-correlation-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnSelectorComponent, ColumnSlotComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">Data Frame</label>
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

        <!-- Variables -->
        <app-column-selector [columns]="columns()">
          <app-column-slot name="selectedVars" [label]="'Variables (select 2 or more numeric columns)'"
            filter="numeric" [multiple]="true" [required]="true"
            [columns]="selectedVars()" (columnsChange)="selectedVars.set($event)" />
        </app-column-selector>

        <!-- Method -->
        <div class="form-group">
          <label class="form-label">Correlation Method</label>
          <select 
            class="select select-bordered w-full" 
            [ngModel]="method()"
            (ngModelChange)="method.set($event)"
          >
            <option value="pearson">Pearson (linear)</option>
            <option value="spearman">Spearman (rank)</option>
            <option value="kendall">Kendall (rank)</option>
          </select>
        </div>

        <!-- Options -->
        <div class="form-group">
          <label class="label cursor-pointer justify-start gap-2">
            <input 
              type="checkbox" 
              class="checkbox checkbox-primary" 
              [ngModel]="showPValues()"
              (ngModelChange)="showPValues.set($event)"
            />
            <span>Show p-values</span>
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
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class CorrelationDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(CorrelationDialogComponent); }
  static readonly dialogId = 'correlation';

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'correlation',
      componentType: 'CorrelationDialogComponent',
      title: 'Correlation Analysis',
      family: 'inferential',
      description: 'Correlation matrix between numeric variables.',
      operations: ['describe.association.numeric_numeric'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('selectedVars', 'column[]', { required: true, filter: 'numeric' }),
        p('method', 'enum', { enumValues: ['pearson', 'spearman', 'kendall'] }),
        p('showPValues', 'boolean'),
      ],
      retrievalHints: {
        keywords: ['correlation', 'correlate', 'pearson', 'spearman', 'association'],
      },
    };
  }

  selectedVars = signal<string[]>([]);
  method = signal<'pearson' | 'spearman' | 'kendall'>('pearson');
  showPValues = signal(true);

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      selectedVars: this.selectedVars,
      method: this.method,
      showPValues: this.showPValues,
    });

    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return buildCorrelation({
          dataframe: '',
          selectedVars: [],
        });
      }

      return buildCorrelation({
        dataframe: df,
        selectedVars: this.selectedVars(),
        method: this.method(),
        showPValues: this.showPValues(),
      });
    });

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.selectedVars();
      this.method();
      this.showPValues();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.selectedVars().length >= 2;
  }
}
