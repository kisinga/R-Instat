import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { buildSort } from '../../../core/dialogs/builders/data-manipulation';

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
          
          @for (sort of sortColumns(); track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-center">
              <select 
                class="select select-bordered select-sm flex-1"
                [ngModel]="sort.column"
                (ngModelChange)="updateSortColumn(i, 'column', $event)"
              >
                <option value="">Select column...</option>
                @for (col of columns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>

              <select 
                class="select select-bordered select-sm w-32"
                [ngModel]="sort.descending"
                (ngModelChange)="updateSortColumn(i, 'descending', $event)"
              >
                <option [ngValue]="false">Ascending ↑</option>
                <option [ngValue]="true">Descending ↓</option>
              </select>

              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeSortColumn(i)"
                [disabled]="sortColumns().length === 1"
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
            <pre class="code-block">{{ rCode() }}</pre>
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
export class SortDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Sort Data';

  // Dialog state using signals for reactivity
  sortColumns = signal<SortColumn[]>([{ column: '', descending: false }]);

  addSortColumn(): void {
    this.sortColumns.update(s => [...s, { column: '', descending: false }]);
  }

  removeSortColumn(index: number): void {
    this.sortColumns.update(s => s.filter((_, i) => i !== index));
  }

  updateSortColumn(index: number, field: 'column' | 'descending', value: string | boolean): void {
    this.sortColumns.update(s => {
      const updated = [...s];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildSort({
        dataframe: this.selectedDataframe(),
        sortColumns: this.sortColumns(),
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    effect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.sortColumns();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.sortColumns().some(s => s.column);
  }
}
