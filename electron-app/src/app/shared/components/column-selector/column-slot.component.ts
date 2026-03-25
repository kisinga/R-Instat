import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  inject, signal, computed, type WritableSignal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { ColumnTypeHint } from '../../../core/ai/dialog-schema.registry';
import { ColumnInfo, mapRTypeToCategory, getColumnTypeIcon } from '../../../core/models/r.model';
import { ColumnSelectorCoordinator } from './column-selector.coordinator';

@Component({
  selector: 'app-column-slot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="column-slot" [class.active]="isActive()" [class.filled]="hasFilled()">
      <label class="slot-label">{{ label }}
        @if (required) { <span class="text-error">*</span> }
      </label>

      @if (availableColumns().length > 5) {
        <input type="text" class="input input-xs input-bordered w-full mb-1"
          placeholder="Search columns..."
          [ngModel]="searchQuery()" (ngModelChange)="searchQuery.set($event)" />
      }

      <div class="slot-column-list" [class.multi]="multiple"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
        (dragenter)="dragOver.set(true)"
        (dragleave)="dragOver.set(false)"
        [class.drag-over]="dragOver()">

        @for (col of filteredColumns(); track col.name) {
          <label class="slot-column-item"
            [class.selected]="isSelected(col.name)"
            [class.used-elsewhere]="isUsedElsewhere(col.name)">
            @if (multiple) {
              <input type="checkbox" class="checkbox checkbox-xs checkbox-primary"
                [checked]="isSelected(col.name)"
                (change)="toggleColumn(col.name)" />
            } @else {
              <input type="radio" class="radio radio-xs radio-primary"
                [checked]="isSelected(col.name)"
                (change)="selectColumn(col.name)"
                [name]="'slot-' + name" />
            }
            <span class="col-type-icon" [class]="'col-type-' + getTypeCategory(col.type)">
              {{ getTypeIcon(col.type) }}
            </span>
            <span class="col-name">{{ col.name }}</span>
          </label>
        }

        @if (filteredColumns().length === 0) {
          <div class="text-center text-base-content/50 py-3 text-xs">No matching columns</div>
        }
      </div>

      @if (multiple && selectedCount() > 0) {
        <div class="text-xs text-base-content/60 mt-1">{{ selectedCount() }} selected</div>
      }
    </div>
  `,
  styles: [`
    .column-slot {
      @apply w-full min-w-0;
    }

    .slot-label {
      @apply block text-sm font-medium mb-1;
    }

    .slot-column-list {
      @apply border border-base-300 rounded-lg max-h-48 overflow-y-auto overflow-x-auto transition-colors;
      min-width: 220px;
    }

    .slot-column-list.multi {
      @apply max-h-64;
    }

    .slot-column-list.drag-over {
      @apply border-primary border-2 bg-primary/5;
    }

    .slot-column-item {
      @apply flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0 text-sm;
      min-width: max-content;
    }

    .slot-column-item.selected {
      @apply bg-primary/10;
    }

    .slot-column-item.used-elsewhere {
      @apply opacity-40;
    }

    .col-type-icon {
      @apply text-xs font-mono w-5 text-center flex-shrink-0;
    }

    .col-name {
      @apply text-sm whitespace-nowrap;
    }

    .column-slot.active .slot-column-list {
      @apply ring-2 ring-primary/30;
    }

    .column-slot.filled .slot-label {
      @apply text-success;
    }
  `],
})
export class ColumnSlotComponent implements OnInit, OnDestroy {
  @Input({ required: true }) name!: string;
  @Input({ required: true }) label!: string;
  @Input() filter?: ColumnTypeHint;
  @Input() required = false;
  @Input() multiple = false;

  // Single-select two-way binding
  @Input() column = '';
  @Output() columnChange = new EventEmitter<string>();

  // Multi-select two-way binding
  @Input() columns: string[] = [];
  @Output() columnsChange = new EventEmitter<string[]>();

  private coordinator = inject(ColumnSelectorCoordinator);

  searchQuery = signal('');
  dragOver = signal(false);

  // Internal writable signal that the coordinator reads
  valueSignal: WritableSignal<any> = signal<any>('');

  availableColumns = signal<ColumnInfo[]>([]);
  private availableColumnsComputed!: ReturnType<typeof computed>;

  filteredColumns = computed(() => {
    let cols = this.availableColumns();
    const query = this.searchQuery();
    if (query) {
      const lower = query.toLowerCase();
      cols = cols.filter(c => c.name.toLowerCase().includes(lower));
    }
    return cols;
  });

  isActive = computed(() => this.coordinator.activeSlotName() === this.name);

  hasFilled = computed(() => {
    const v = this.valueSignal();
    return this.multiple ? (Array.isArray(v) && v.length > 0) : !!v;
  });

  selectedCount = computed(() => {
    const v = this.valueSignal();
    return Array.isArray(v) ? v.length : 0;
  });

  ngOnInit(): void {
    // Initialize internal signal from input
    this.valueSignal.set(this.multiple ? this.columns : this.column);

    this.coordinator.register({
      name: this.name,
      filter: this.filter,
      required: this.required,
      multiple: this.multiple,
      value: this.valueSignal,
    });

    // Set up reactive available columns from coordinator
    const coordAvailable = this.coordinator.getAvailableColumns(this.name);
    this.availableColumnsComputed = computed(() => coordAvailable());
    // Sync computed into the signal (for template reactivity)
    this.syncAvailableColumns();
  }

  private syncAvailableColumns(): void {
    // Use a simple polling approach via Angular's change detection
    // The computed from coordinator will be re-evaluated on each CD cycle
    const coordAvailable = this.coordinator.getAvailableColumns(this.name);
    // Override availableColumns as a computed directly
    (this as any).availableColumns = coordAvailable;
  }

  ngOnDestroy(): void {
    this.coordinator.unregister(this.name);
  }

  isSelected(colName: string): boolean {
    const v = this.valueSignal();
    if (this.multiple) {
      return Array.isArray(v) && v.includes(colName);
    }
    return v === colName;
  }

  isUsedElsewhere(colName: string): boolean {
    if (!this.coordinator.excludeUsed()) return false;
    const used = this.coordinator.usedColumns();
    return used.has(colName) && !this.isSelected(colName);
  }

  selectColumn(colName: string): void {
    this.valueSignal.set(colName);
    this.column = colName;
    this.columnChange.emit(colName);
    this.coordinator.onColumnSelected(this.name);
  }

  toggleColumn(colName: string): void {
    const current: string[] = Array.isArray(this.valueSignal()) ? [...this.valueSignal()] : [];
    const idx = current.indexOf(colName);
    if (idx === -1) {
      current.push(colName);
    } else {
      current.splice(idx, 1);
    }
    this.valueSignal.set(current);
    this.columns = current;
    this.columnsChange.emit(current);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const colName = event.dataTransfer?.getData('text/plain');
    if (!colName) return;

    if (this.multiple) {
      this.toggleColumn(colName);
    } else {
      this.selectColumn(colName);
    }
  }

  getTypeCategory(type: string): string {
    return mapRTypeToCategory(type);
  }

  getTypeIcon(type: string): string {
    return getColumnTypeIcon(mapRTypeToCategory(type));
  }
}
