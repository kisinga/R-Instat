/**
 * GenericFormSectionComponent — Composable form section
 *
 * Renders a list of DialogParamSchema entries as form fields.
 * This is the reusable composition unit for the generic dialog.
 *
 * Future extensions:
 * - Steps: the shell renders N sections, one per step
 * - SubPaths: the shell renders the section matching the active branch
 * - Grouped sections: wrap this component with a heading/collapsible panel
 */

import { Component, Input, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';
import { GenericFieldComponent } from './generic-field.component';

@Component({
  selector: 'app-generic-form-section',
  standalone: true,
  imports: [CommonModule, GenericFieldComponent],
  template: `
    @for (param of params; track param.name) {
      @if (isVisible(param)) {
        <app-generic-field
          [param]="param"
          [value]="getSignal(param.name)"
          [columns]="columns"
        />
      }
    }
  `,
})
export class GenericFormSectionComponent {
  @Input({ required: true }) params: DialogParamSchema[] = [];
  @Input({ required: true }) state!: Map<string, WritableSignal<any>>;
  @Input() columns: ColumnInfo[] = [];
  @Input() isVisible: (param: DialogParamSchema) => boolean = () => true;

  getSignal(name: string): WritableSignal<any> {
    const sig = this.state.get(name);
    if (!sig) {
      throw new Error(`[GenericFormSection] No signal for param "${name}"`);
    }
    return sig;
  }
}
