import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';

interface SortColumn {
  column: string;
  descending: boolean;
}

@Component({
  selector: 'app-sort-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

        <!-- Sort Columns -->
        <div class="form-group">
          <label class="form-label">Sort By</label>
          
          @for (sort of sortColumns; track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-center">
              <select 
                class="select select-bordered select-sm flex-1"
                [(ngModel)]="sort.column"
              >
                <option value="">Select column...</option>
                @for (col of columns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>

              <select 
                class="select select-bordered select-sm w-32"
                [(ngModel)]="sort.descending"
              >
                <option [ngValue]="false">Ascending ↑</option>
                <option [ngValue]="true">Descending ↓</option>
              </select>

              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeSortColumn(i)"
                [disabled]="sortColumns.length === 1"
              >
                ✕
              </button>
            </div>
          }

          <button class="btn btn-ghost btn-sm" (click)="addSortColumn()">
            + Add Sort Column
          </button>
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
export class SortDialogComponent extends DialogBase {
  readonly dialogTitle = 'Sort Data';

  sortColumns: SortColumn[] = [
    { column: '', descending: false }
  ];

  addSortColumn(): void {
    this.sortColumns = [...this.sortColumns, { column: '', descending: false }];
  }

  removeSortColumn(index: number): void {
    this.sortColumns = this.sortColumns.filter((_, i) => i !== index);
  }

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    
    const sortExprs = this.sortColumns
      .filter(s => s.column)
      .map(s => s.descending ? `desc(${s.column})` : s.column);

    if (sortExprs.length === 0) {
      return '# Select columns to sort by';
    }

    return `sorted_data <- get_dataframe("${df}") %>%
  dplyr::arrange(${sortExprs.join(', ')})

add_dataframe("${df}", sorted_data)`;
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.sortColumns.some(s => s.column);
  }
}
