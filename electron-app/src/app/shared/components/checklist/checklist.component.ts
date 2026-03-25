import {
  Component, Input, Output, EventEmitter, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { ChecklistOption } from '../../../core/ai/dialog-schema.registry';

interface CategoryGroup {
  name: string | null;
  options: ChecklistOption[];
}

@Component({
  selector: 'app-checklist',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Option grid grouped by category -->
    @for (group of categoryGroups(); track group.name) {
      @if (group.name) {
        <div class="text-xs font-medium text-base-content/60 mt-2 mb-1">{{ group.name }}</div>
      }
      <div class="checklist-grid">
        @for (opt of group.options; track opt.key) {
          <label class="checklist-item" [class.selected]="isSelected(opt.key)">
            <input type="checkbox" class="checkbox checkbox-xs checkbox-primary"
              [checked]="isSelected(opt.key)"
              (change)="toggle(opt.key)" />
            <span class="text-sm">{{ opt.label }}</span>
          </label>
        }
      </div>
    }

    <!-- Reorderable selected chips -->
    @if (reorderable && selected.length > 0) {
      <div class="chip-list">
        @for (key of selected; track key; let i = $index) {
          <div class="badge badge-primary badge-sm gap-1 cursor-grab"
            draggable="true"
            (dragstart)="onDragStart($event, i)"
            (dragover)="onDragOver($event)"
            (drop)="onDrop($event, i)">
            {{ getLabel(key) }}
            <button class="btn btn-ghost btn-circle" style="width:14px;height:14px;min-height:0;padding:0;font-size:10px;"
              (click)="toggle(key)">×</button>
          </div>
        }
      </div>
    }

    @if (selected.length > 0) {
      <div class="text-xs text-base-content/60 mt-1">{{ selected.length }} selected</div>
    }
  `,
  styles: [`
    .checklist-grid {
      @apply grid grid-cols-3 gap-1;
    }
    .checklist-item {
      @apply flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer hover:bg-base-200 transition-colors text-sm;
    }
    .checklist-item.selected {
      @apply bg-primary/10;
    }
    .chip-list {
      @apply flex flex-wrap gap-1 mt-2 pt-2 border-t border-base-300;
    }
  `],
})
export class ChecklistComponent {
  @Input({ required: true }) options: ChecklistOption[] = [];
  @Input() reorderable = false;
  @Input() selected: string[] = [];
  @Output() selectedChange = new EventEmitter<string[]>();

  private dragIndex = -1;

  private optionsSignal = signal<ChecklistOption[]>([]);

  categoryGroups = computed(() => {
    const opts = this.options;
    const ungrouped: ChecklistOption[] = [];
    const groupMap = new Map<string, ChecklistOption[]>();

    for (const opt of opts) {
      if (opt.category) {
        const list = groupMap.get(opt.category) ?? [];
        list.push(opt);
        groupMap.set(opt.category, list);
      } else {
        ungrouped.push(opt);
      }
    }

    const result: CategoryGroup[] = [];
    if (ungrouped.length > 0) {
      result.push({ name: null, options: ungrouped });
    }
    for (const [name, options] of groupMap) {
      result.push({ name, options });
    }
    return result;
  });

  isSelected(key: string): boolean {
    return this.selected.includes(key);
  }

  getLabel(key: string): string {
    return this.options.find(o => o.key === key)?.label ?? key;
  }

  toggle(key: string): void {
    const current = [...this.selected];
    const idx = current.indexOf(key);
    if (idx === -1) {
      current.push(key);
    } else {
      current.splice(idx, 1);
    }
    this.selected = current;
    this.selectedChange.emit(current);
  }

  onDragStart(event: DragEvent, index: number): void {
    this.dragIndex = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent, targetIndex: number): void {
    event.preventDefault();
    if (this.dragIndex < 0 || this.dragIndex === targetIndex) return;

    const current = [...this.selected];
    const [moved] = current.splice(this.dragIndex, 1);
    current.splice(targetIndex, 0, moved);
    this.dragIndex = -1;

    this.selected = current;
    this.selectedChange.emit(current);
  }
}
