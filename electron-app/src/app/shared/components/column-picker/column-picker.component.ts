import { Component, Input, Output, EventEmitter, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { ColumnInfo, mapRTypeToCategory, getColumnTypeIcon } from '../../../core/models/r.model';

@Component({
  selector: 'app-column-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="column-picker">
      <!-- Search -->
      @if (searchable && columnsSignal().length > 5) {
        <input
          type="text"
          class="input input-sm input-bordered w-full mb-2"
          [placeholder]="'COLUMN_PICKER.SEARCH' | translate"
          [(ngModel)]="searchQuery"
        />
      }

      <!-- Column List -->
      <div class="column-list" [class.multi]="multiple">
        @for (col of filteredColumns(); track col.name) {
          <label 
            class="column-item"
            [class.selected]="isSelected(col.name)"
          >
            @if (multiple) {
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                [checked]="isSelected(col.name)"
                (change)="toggleColumn(col.name)"
              />
            } @else {
              <input
                type="radio"
                class="radio radio-sm radio-primary"
                [checked]="isSelected(col.name)"
                (change)="selectColumn(col.name)"
                [name]="radioGroup"
              />
            }
            <span class="column-type" [class]="'col-type-' + getTypeCategory(col.type)">
              {{ getTypeIcon(col.type) }}
            </span>
            <span class="column-name">{{ col.name }}</span>
            <span class="column-type-label">{{ col.type }}</span>
          </label>
        }

        @if (filteredColumns().length === 0) {
          <div class="text-center text-base-content/50 py-4 text-sm">
            @if (searchQuery) {
              {{ 'COLUMN_PICKER.NO_MATCH' | translate: {query: searchQuery} }}
            } @else {
              {{ 'COLUMN_PICKER.NO_COLUMNS' | translate }}
            }
          </div>
        }
      </div>

      <!-- Selected count for multi-select -->
      @if (multiple && selectedColumns.length > 0) {
        <div class="text-xs text-base-content/60 mt-2">
          {{ 'COLUMN_PICKER.SELECTED_COUNT' | translate: {count: selectedColumns.length} }}
        </div>
      }
    </div>
  `,
  styles: [`
    .column-picker {
      @apply w-full;
    }

    .column-list {
      @apply border border-base-300 rounded-lg max-h-48 overflow-y-auto;
    }

    .column-list.multi {
      @apply max-h-64;
    }

    .column-item {
      @apply flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0;
    }

    .column-item.selected {
      @apply bg-primary/10;
    }

    .column-type {
      @apply text-xs font-mono w-5 text-center;
    }

    .column-name {
      @apply flex-1 text-sm truncate;
    }

    .column-type-label {
      @apply text-xs text-base-content/50;
    }
  `]
})
export class ColumnPickerComponent {
  // Use setter to update internal signal when input changes
  private _columns: ColumnInfo[] = [];
  @Input() 
  set columns(value: ColumnInfo[]) {
    this._columns = value;
    this.columnsSignal.set(value);
  }
  get columns(): ColumnInfo[] {
    return this._columns;
  }

  @Input() multiple = false;
  @Input() searchable = true;
  @Input() filterTypes: string[] = []; // Empty means all types
  @Input() radioGroup = 'column-picker-' + Math.random().toString(36).slice(2);

  // For single select
  @Input() selectedColumn = '';
  @Output() selectedColumnChange = new EventEmitter<string>();

  // For multi select
  @Input() selectedColumns: string[] = [];
  @Output() selectedColumnsChange = new EventEmitter<string[]>();

  // Internal signal for reactivity
  columnsSignal = signal<ColumnInfo[]>([]);
  searchQuerySignal = signal('');
  
  get searchQuery(): string {
    return this.searchQuerySignal();
  }
  set searchQuery(value: string) {
    this.searchQuerySignal.set(value);
  }

  // Computed signal that reacts to both columns and search changes
  filteredColumns = computed(() => {
    let cols = this.columnsSignal();

    // Filter by type if specified
    if (this.filterTypes.length > 0) {
      cols = cols.filter(col => 
        this.filterTypes.some(t => col.type.toLowerCase().includes(t.toLowerCase()))
      );
    }

    // Filter by search query
    const query = this.searchQuerySignal();
    if (query) {
      const lowerQuery = query.toLowerCase();
      cols = cols.filter(col => col.name.toLowerCase().includes(lowerQuery));
    }

    return cols;
  });

  isSelected(name: string): boolean {
    if (this.multiple) {
      return this.selectedColumns.includes(name);
    }
    return this.selectedColumn === name;
  }

  selectColumn(name: string): void {
    this.selectedColumn = name;
    this.selectedColumnChange.emit(name);
  }

  toggleColumn(name: string): void {
    const current = [...this.selectedColumns];
    const index = current.indexOf(name);
    
    if (index === -1) {
      current.push(name);
    } else {
      current.splice(index, 1);
    }

    this.selectedColumns = current;
    this.selectedColumnsChange.emit(current);
  }

  getTypeCategory(type: string): string {
    return mapRTypeToCategory(type);
  }

  getTypeIcon(type: string): string {
    return getColumnTypeIcon(mapRTypeToCategory(type));
  }
}
