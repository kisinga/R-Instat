import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-calculate-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
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
            [(ngModel)]="newColumnName"
          />
        </div>

        <!-- Calculation Type -->
        <div class="form-group">
          <label class="form-label">Calculation Type</label>
          <select class="select select-bordered w-full" [(ngModel)]="calcType">
            <option value="formula">Custom Formula</option>
            <option value="sum">Sum of Columns</option>
            <option value="mean">Mean of Columns</option>
            <option value="diff">Difference (A - B)</option>
            <option value="ratio">Ratio (A / B)</option>
          </select>
        </div>

        @if (calcType === 'formula') {
          <div class="form-group">
            <label class="form-label">Formula</label>
            <textarea
              class="textarea textarea-bordered w-full font-mono"
              rows="3"
              placeholder="e.g., column_a + column_b * 2"
              [(ngModel)]="formula"
            ></textarea>
            <p class="form-hint">Use column names directly. Available functions: log, sqrt, abs, round, etc.</p>
          </div>
        } @else if (calcType === 'sum' || calcType === 'mean') {
          <div class="form-group">
            <label class="form-label">Columns to {{ calcType === 'sum' ? 'Sum' : 'Average' }}</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="true"
              [(selectedColumns)]="selectedCols"
            />
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Column A</label>
              <select class="select select-bordered w-full" [(ngModel)]="columnA">
                @for (col of getNumericColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Column B</label>
              <select class="select select-bordered w-full" [(ngModel)]="columnB">
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
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
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
export class CalculateDialogComponent extends DialogBase {
  readonly dialogTitle = 'Calculate New Column';

  newColumnName = '';
  calcType = 'formula';
  formula = '';
  selectedCols: string[] = [];
  columnA = '';
  columnB = '';

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    
    const colName = this.newColumnName || 'new_column';
    
    let expression = '';
    
    switch (this.calcType) {
      case 'formula':
        expression = this.formula || '0';
        break;
      case 'sum':
        if (this.selectedCols.length > 0) {
          expression = this.selectedCols.join(' + ');
        }
        break;
      case 'mean':
        if (this.selectedCols.length > 0) {
          expression = `(${this.selectedCols.join(' + ')}) / ${this.selectedCols.length}`;
        }
        break;
      case 'diff':
        if (this.columnA && this.columnB) {
          expression = `${this.columnA} - ${this.columnB}`;
        }
        break;
      case 'ratio':
        if (this.columnA && this.columnB) {
          expression = `${this.columnA} / ${this.columnB}`;
        }
        break;
    }

    if (!expression) {
      return `# Please specify the calculation`;
    }

    return `updated_data <- get_dataframe("${df}") %>%
  dplyr::mutate(${colName} = ${expression})

add_dataframe("${df}", updated_data)`;
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.newColumnName) {
      return false;
    }

    switch (this.calcType) {
      case 'formula':
        return !!this.formula;
      case 'sum':
      case 'mean':
        return this.selectedCols.length > 0;
      case 'diff':
      case 'ratio':
        return !!this.columnA && !!this.columnB;
      default:
        return false;
    }
  }
}
