import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

interface RecodeMapping {
  from: string;
  to: string;
}

@Component({
  selector: 'app-recode-dialog',
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

        <!-- Column to Recode -->
        <div class="form-group">
          <label class="form-label">Column to Recode</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="false"
            [(selectedColumn)]="sourceColumn"
          />
        </div>

        <!-- New Column Name -->
        <div class="form-group">
          <label class="form-label">New Column Name (optional)</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Leave empty to overwrite original"
            [(ngModel)]="newColumnName"
          />
        </div>

        <!-- Recode Mappings -->
        <div class="form-group">
          <label class="form-label">Recode Values</label>
          
          @for (mapping of mappings; track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-center">
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="From value..."
                [(ngModel)]="mapping.from"
              />
              <span class="text-base-content/50">→</span>
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="To value..."
                [(ngModel)]="mapping.to"
              />
              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeMapping(i)"
                [disabled]="mappings.length === 1"
              >
                ✕
              </button>
            </div>
          }

          <button class="btn btn-ghost btn-sm" (click)="addMapping()">
            + Add Mapping
          </button>
        </div>

        <!-- Default Value -->
        <div class="form-group">
          <label class="form-label">Default Value (for unmatched values)</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Leave empty to keep original value"
            [(ngModel)]="defaultValue"
          />
        </div>

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
export class RecodeDialogComponent extends DialogBase {
  readonly dialogTitle = 'Recode Values';

  sourceColumn = '';
  newColumnName = '';
  mappings: RecodeMapping[] = [
    { from: '', to: '' }
  ];
  defaultValue = '';

  addMapping(): void {
    this.mappings = [...this.mappings, { from: '', to: '' }];
  }

  removeMapping(index: number): void {
    this.mappings = this.mappings.filter((_, i) => i !== index);
  }

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.sourceColumn) return '# Select a source column';
    
    const targetCol = this.newColumnName || this.sourceColumn;
    
    const validMappings = this.mappings.filter(m => m.from && m.to);
    
    if (validMappings.length === 0) {
      return '# Add at least one recode mapping';
    }

    const caseWhens = validMappings.map(m => {
      const isFromNumeric = !isNaN(Number(m.from));
      const isToNumeric = !isNaN(Number(m.to));
      const fromVal = isFromNumeric ? m.from : `"${m.from}"`;
      const toVal = isToNumeric ? m.to : `"${m.to}"`;
      return `${this.sourceColumn} == ${fromVal} ~ ${toVal}`;
    });

    // Add default
    let defaultExpr = this.sourceColumn; // Keep original
    if (this.defaultValue) {
      const isNumeric = !isNaN(Number(this.defaultValue));
      defaultExpr = isNumeric ? this.defaultValue : `"${this.defaultValue}"`;
    }
    caseWhens.push(`TRUE ~ ${defaultExpr}`);

    return `recoded_data <- get_dataframe("${df}") %>%
  dplyr::mutate(
    ${targetCol} = dplyr::case_when(
      ${caseWhens.join(',\n      ')}
    )
  )

add_dataframe("${df}", recoded_data)`;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && 
      !!this.sourceColumn && 
      this.mappings.some(m => m.from && m.to);
  }
}
