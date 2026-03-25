import { Injectable, computed, signal, type WritableSignal, type Signal } from '@angular/core';
import type { ColumnInfo } from '../../../core/models/r.model';
import type { ColumnTypeHint } from '../../../core/ai/dialog-schema.registry';
import { filterColumnsByType } from '../../../features/dialogs/generic/utils/column-type-filter';

export interface SlotRegistration {
  name: string;
  filter: ColumnTypeHint | undefined;
  required: boolean;
  multiple: boolean;
  value: WritableSignal<any>;
  order: number;
}

@Injectable()
export class ColumnSelectorCoordinator {
  private slots = signal<SlotRegistration[]>([]);
  private registrationOrder = 0;

  activeSlotName = signal<string | null>(null);
  columns = signal<ColumnInfo[]>([]);
  excludeUsed = signal(false);

  /** Set of column names currently assigned to any slot. */
  usedColumns = computed(() => {
    const used = new Set<string>();
    for (const slot of this.slots()) {
      const v = slot.value();
      if (Array.isArray(v)) {
        v.forEach((c: string) => used.add(c));
      } else if (v) {
        used.add(v as string);
      }
    }
    return used;
  });

  register(slot: Omit<SlotRegistration, 'order'>): void {
    this.slots.update(prev => [
      ...prev,
      { ...slot, order: this.registrationOrder++ },
    ]);
    if (this.activeSlotName() === null) {
      this.activeSlotName.set(slot.name);
    }
  }

  unregister(name: string): void {
    this.slots.update(prev => prev.filter(s => s.name !== name));
    if (this.activeSlotName() === name) {
      this.activeSlotName.set(null);
    }
  }

  /** After a column is selected in a slot, advance focus to next empty required slot. */
  onColumnSelected(slotName: string): void {
    const sorted = [...this.slots()].sort((a, b) => a.order - b.order);
    const currentIdx = sorted.findIndex(s => s.name === slotName);
    if (currentIdx === -1) return;

    // Look for next empty slot (required first, then any)
    for (let i = currentIdx + 1; i < sorted.length; i++) {
      const s = sorted[i];
      const v = s.value();
      const isEmpty = s.multiple ? (!Array.isArray(v) || v.length === 0) : !v;
      if (isEmpty) {
        this.activeSlotName.set(s.name);
        return;
      }
    }
    // No empty slot found — stay on current
  }

  /** Auto-fill: for each empty slot, if exactly 1 column matches its filter, select it. */
  autoFill(): void {
    const cols = this.columns();
    if (cols.length === 0) return;

    const sorted = [...this.slots()].sort((a, b) => a.order - b.order);
    const usedSoFar = new Set<string>();

    for (const slot of sorted) {
      if (slot.multiple) continue; // auto-fill only for single-select

      const v = slot.value();
      if (v) {
        usedSoFar.add(v as string);
        continue;
      }

      let candidates = filterColumnsByType(cols, slot.filter);
      if (this.excludeUsed()) {
        candidates = candidates.filter(c => !usedSoFar.has(c.name));
      }

      if (candidates.length === 1) {
        slot.value.set(candidates[0].name);
        usedSoFar.add(candidates[0].name);
      }
    }
  }

  /** Get filtered columns available for a specific slot. */
  getAvailableColumns(slotName: string): Signal<ColumnInfo[]> {
    return computed(() => {
      const slot = this.slots().find(s => s.name === slotName);
      if (!slot) return [];

      let cols = filterColumnsByType(this.columns(), slot.filter);
      if (this.excludeUsed()) {
        const used = this.usedColumns();
        const ownValue = slot.value();
        cols = cols.filter(c => !used.has(c.name) || c.name === ownValue);
      }
      return cols;
    });
  }
}
