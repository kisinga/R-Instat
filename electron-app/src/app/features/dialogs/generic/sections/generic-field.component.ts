/**
 * GenericFieldComponent — Atomic control renderer
 *
 * Renders a single DialogParamSchema as the appropriate form control.
 * This is the lowest-level building block of the generic dialog system.
 *
 * Supported kinds:
 * - column    → ColumnPicker (single select, type-filtered)
 * - column[]  → ColumnPicker (multi select, type-filtered)
 * - enum      → <select> with enumValues
 * - boolean   → <checkbox>
 * - number    → <input type="number"> with min/max
 * - string    → <input type="text">
 *
 * The 'dataframe' kind is handled by the shell, not this component.
 */

import { Component, Input, computed, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { filterColumnsByType } from '../utils/column-type-filter';

@Component({
  selector: 'app-generic-field',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
  template: `
    <!-- Boolean renders its own label inline -->
    @if (param.kind === 'boolean') {
      <div class="form-group">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" class="checkbox checkbox-primary"
            [ngModel]="value()" (ngModelChange)="value.set($event)" />
          <span>{{ formatLabel(param.name) }}</span>
        </label>
      </div>
    } @else {
      <div class="form-group">
        <label class="form-label">{{ formatLabel(param.name) }}
          @if (param.required) { <span class="text-error">*</span> }
        </label>

        @switch (param.kind) {
          @case ('column') {
            <app-column-picker
              [columns]="filteredColumns()"
              [multiple]="false"
              [selectedColumn]="value()"
              (selectedColumnChange)="value.set($event)"
            />
          }
          @case ('column[]') {
            <app-column-picker
              [columns]="filteredColumns()"
              [multiple]="true"
              [selectedColumns]="value() || []"
              (selectedColumnsChange)="value.set($event)"
            />
          }
          @case ('enum') {
            <select class="select select-bordered w-full"
              [ngModel]="value()" (ngModelChange)="value.set($event)">
              @for (opt of param.enumValues ?? []; track opt) {
                <option [value]="opt">{{ formatLabel(opt) }}</option>
              }
            </select>
          }
          @case ('number') {
            <input type="number" class="input input-bordered w-full"
              [min]="param.min ?? null" [max]="param.max ?? null"
              [ngModel]="value()" (ngModelChange)="value.set(+$event)" />
          }
          @case ('string') {
            <input type="text" class="input input-bordered w-full"
              [placeholder]="'Enter ' + formatLabel(param.name) + '...'"
              [ngModel]="value()" (ngModelChange)="value.set($event)" />
          }
        }
      </div>
    }
  `,
})
export class GenericFieldComponent {
  @Input({ required: true }) param!: DialogParamSchema;
  @Input({ required: true }) value!: WritableSignal<any>;
  @Input() columns: ColumnInfo[] = [];

  readonly filteredColumns = computed(() =>
    filterColumnsByType(this.columns, this.param?.columnType)
  );

  formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }
}
