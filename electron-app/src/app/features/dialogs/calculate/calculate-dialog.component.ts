import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildCalculate } from '../../../core/dialogs/builders/data-manipulation';
import type { DialogPromptContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-calculate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, CodePreviewComponent],
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

        <!-- New Column Name -->
        <div class="form-group">
          <label class="form-label">New Column Name</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="e.g., total_score"
            [ngModel]="newColumnName()"
            (ngModelChange)="newColumnName.set($event)"
          />
        </div>

        <!-- Calculation Type -->
        <div class="form-group">
          <label class="form-label">Calculation Type</label>
          <select class="select select-bordered w-full" [ngModel]="calcType()" (ngModelChange)="calcType.set($event)">
            <option value="formula">Custom Formula</option>
            <option value="sum">Sum of Columns</option>
            <option value="mean">Mean of Columns</option>
            <option value="diff">Difference (A - B)</option>
            <option value="ratio">Ratio (A / B)</option>
          </select>
        </div>

        @if (calcType() === 'formula') {
          <div class="form-group">
            <label class="form-label">Formula</label>
            <textarea
              class="textarea textarea-bordered w-full font-mono"
              rows="3"
              placeholder="e.g., column_a + column_b * 2"
              [ngModel]="formula()"
              (ngModelChange)="formula.set($event)"
            ></textarea>
            <p class="form-hint">Use column names directly. Available functions: log, sqrt, abs, round, etc.</p>
          </div>
        } @else if (calcType() === 'sum' || calcType() === 'mean') {
          <div class="form-group">
            <label class="form-label">Columns to {{ calcType() === 'sum' ? 'Sum' : 'Average' }}</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="true"
              [(selectedColumns)]="selectedColsArray"
            />
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Column A</label>
              <select class="select select-bordered w-full" [ngModel]="columnA()" (ngModelChange)="columnA.set($event)">
                @for (col of getNumericColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Column B</label>
              <select class="select select-bordered w-full" [ngModel]="columnB()" (ngModelChange)="columnB.set($event)">
                @for (col of getNumericColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
          </div>
        }

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
export class CalculateDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(CalculateDialogComponent); }
  static readonly dialogId = 'calculate';
  readonly dialogTitle = 'Calculate New Column';

  static override getCatalogDescriptor(): DialogPromptContract {
    return {
      dialogId: 'calculate',
      componentType: 'CalculateDialogComponent',
      family: 'data-preparation',
      description: 'Create a new derived column from formula/arithmetic.',
      operations: ['data.calculate'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('newColumnName', 'string', { required: true }),
        p('calcType', 'enum', { required: true, enumValues: ['formula', 'sum', 'mean', 'diff', 'ratio'] }),
        p('formula', 'string', { when: { param: 'calcType', equals: 'formula' } }),
        p('selectedCols', 'column[]', { columnType: 'numeric', when: { param: 'calcType', equals: 'sum' } }),
        p('selectedCols', 'column[]', { columnType: 'numeric', when: { param: 'calcType', equals: 'mean' } }),
        p('columnA', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'diff' } }),
        p('columnB', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'diff' } }),
        p('columnA', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'ratio' } }),
        p('columnB', 'column', { columnType: 'numeric', when: { param: 'calcType', equals: 'ratio' } }),
      ],
      retrievalHints: {
        keywords: ['calculate', 'new column', 'derived', 'formula', 'computed'],
      },
    };
  }

  // Dialog state using signals for reactivity
  newColumnName = signal('');
  calcType = signal<'formula' | 'sum' | 'mean' | 'diff' | 'ratio'>('formula');
  formula = signal('');
  selectedCols = signal<string[]>([]);
  columnA = signal('');
  columnB = signal('');

  // Property for two-way binding with column picker (syncs with signal)
  get selectedColsArray(): string[] {
    return this.selectedCols();
  }
  set selectedColsArray(value: string[]) {
    this.selectedCols.set(value);
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      newColumnName: this.newColumnName,
      calcType: this.calcType,
      formula: this.formula,
      selectedCols: this.selectedCols,
      columnA: this.columnA,
      columnB: this.columnB,
    });

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildCalculate({
        dataframe: this.selectedDataframe(),
        newColumnName: this.newColumnName() || 'new_column',
        calcType: this.calcType(),
        formula: this.formula() || undefined,
        selectedCols: this.selectedCols().length > 0 ? this.selectedCols() : undefined,
        columnA: this.columnA() || undefined,
        columnB: this.columnB() || undefined,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.newColumnName();
      this.calcType();
      this.formula();
      this.selectedCols();
      this.columnA();
      this.columnB();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.newColumnName()) {
      return false;
    }

    switch (this.calcType()) {
      case 'formula':
        return !!this.formula();
      case 'sum':
      case 'mean':
        return this.selectedCols().length > 0;
      case 'diff':
      case 'ratio':
        return !!this.columnA() && !!this.columnB();
      default:
        return false;
    }
  }
}
