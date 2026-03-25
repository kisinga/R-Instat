import {
  Component, Input, AfterContentInit, OnInit, OnChanges, SimpleChanges,
  inject, effect, Injector, runInInjectionContext,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ColumnInfo, mapRTypeToCategory, getColumnTypeIcon } from '../../../core/models/r.model';
import { ColumnSelectorCoordinator } from './column-selector.coordinator';

@Component({
  selector: 'app-column-selector',
  standalone: true,
  imports: [CommonModule],
  providers: [ColumnSelectorCoordinator],
  template: `
    <div class="column-selector" [class.with-master]="showMasterList">
      @if (showMasterList) {
        <div class="master-list">
          <div class="text-xs font-medium text-base-content/60 mb-1 px-1">Available Columns</div>
          <div class="master-list-items">
            @for (col of coordinator.columns(); track col.name) {
              <div class="master-column-item"
                [class.used]="coordinator.usedColumns().has(col.name)"
                draggable="true"
                (dragstart)="onDragStart($event, col)">
                <span class="col-type-icon" [class]="'col-type-' + getTypeCategory(col.type)">
                  {{ getTypeIcon(col.type) }}
                </span>
                <span class="col-name">{{ col.name }}</span>
              </div>
            }
          </div>
        </div>
      }
      <div class="slot-area">
        <ng-content />
      </div>
    </div>
  `,
  styles: [`
    .column-selector {
      @apply w-full;
    }

    .column-selector.with-master {
      @apply flex gap-4;
    }

    .master-list {
      @apply flex-shrink-0;
      width: 200px;
    }

    .master-list-items {
      @apply border border-base-300 rounded-lg max-h-64 overflow-y-auto;
    }

    .master-column-item {
      @apply flex items-center gap-2 px-2 py-1.5 cursor-grab hover:bg-base-200 transition-colors border-b border-base-300 last:border-b-0 text-sm;
    }

    .master-column-item.used {
      @apply opacity-40;
    }

    .master-column-item:active {
      @apply cursor-grabbing;
    }

    .col-type-icon {
      @apply text-xs font-mono w-5 text-center flex-shrink-0;
    }

    .col-name {
      @apply text-sm whitespace-nowrap;
    }

    .slot-area {
      @apply flex-1 flex flex-col gap-3 min-w-0;
    }
  `],
})
export class ColumnSelectorComponent implements OnInit, OnChanges, AfterContentInit {
  @Input({ required: true }) columns: ColumnInfo[] = [];
  @Input() showMasterList = false;
  @Input() excludeUsed = false;
  @Input() autoFillEnabled = true;

  coordinator = inject(ColumnSelectorCoordinator);
  private injector = inject(Injector);
  private initialized = false;

  ngOnInit(): void {
    this.coordinator.columns.set(this.columns);
    this.coordinator.excludeUsed.set(this.excludeUsed);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns']) {
      this.coordinator.columns.set(this.columns);
      if (this.initialized && this.autoFillEnabled) {
        this.coordinator.autoFill();
      }
    }
    if (changes['excludeUsed']) {
      this.coordinator.excludeUsed.set(this.excludeUsed);
    }
  }

  ngAfterContentInit(): void {
    this.initialized = true;
    if (this.autoFillEnabled) {
      // Delay to let slots register first
      setTimeout(() => this.coordinator.autoFill(), 0);
    }
  }

  onDragStart(event: DragEvent, col: ColumnInfo): void {
    event.dataTransfer?.setData('text/plain', col.name);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  }

  getTypeCategory(type: string): string {
    return mapRTypeToCategory(type);
  }

  getTypeIcon(type: string): string {
    return getColumnTypeIcon(mapRTypeToCategory(type));
  }
}
