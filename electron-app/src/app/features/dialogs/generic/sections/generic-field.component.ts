/**
 * GenericFieldComponent — Atomic control renderer for non-column params.
 *
 * Renders a single DialogParamSchema as the appropriate form control.
 * Column kinds ('column', 'column[]') are handled by the form section
 * via ColumnSelector + ColumnSlot — not by this component.
 *
 * Supported kinds:
 * - enum      → <select> with enumValues
 * - boolean   → <checkbox>
 * - number    → <input type="number"> with min/max
 * - string    → <input type="text">
 *
 * The 'dataframe' kind is handled by the shell, not this component.
 */

import { Component, Input, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';

@Component({
  selector: 'app-generic-field',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Boolean renders its own label inline -->
    @if (param.kind === 'boolean') {
      <div class="form-group">
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" class="checkbox checkbox-primary"
            [ngModel]="value()" (ngModelChange)="value.set($event)" />
          <span>{{ displayLabel() }}</span>
        </label>
      </div>
    } @else {
      <div class="form-group">
        <label class="form-label">{{ displayLabel() }}
          @if (param.required) { <span class="text-error">*</span> }
        </label>

        @switch (param.kind) {
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

  displayLabel(): string {
    return this.param.label ?? this.formatLabel(this.param.name);
  }

  formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }
}
