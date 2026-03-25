/**
 * GenericFormSectionComponent — Composable form section
 *
 * Renders a list of DialogParamSchema entries as form fields.
 * This is the reusable composition unit for the generic dialog.
 *
 * Grouping: params with a `group` field are rendered under a collapsible heading.
 * Ungrouped params render first, then each group in order of first appearance.
 *
 * Future extensions:
 * - Steps: the shell renders N sections, one per step
 * - SubPaths: the shell renders the section matching the active branch
 */

import { Component, Input, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';
import { GenericFieldComponent } from './generic-field.component';

interface ParamGroup {
  label: string | null;
  params: DialogParamSchema[];
}

@Component({
  selector: 'app-generic-form-section',
  standalone: true,
  imports: [CommonModule, GenericFieldComponent],
  template: `
    @for (group of groups; track group.label) {
      @if (group.label) {
        <details class="collapse collapse-arrow bg-base-200 rounded-lg mb-3" open>
          <summary class="collapse-title text-sm font-medium py-2 min-h-0">
            {{ group.label }}
          </summary>
          <div class="collapse-content px-2">
            @for (param of group.params; track param.name) {
              @if (isVisible(param)) {
                <app-generic-field
                  [param]="param"
                  [value]="getSignal(param.name)"
                  [columns]="columns"
                />
              }
            }
          </div>
        </details>
      } @else {
        @for (param of group.params; track param.name) {
          @if (isVisible(param)) {
            <app-generic-field
              [param]="param"
              [value]="getSignal(param.name)"
              [columns]="columns"
            />
          }
        }
      }
    }
  `,
})
export class GenericFormSectionComponent {
  @Input({ required: true }) params: DialogParamSchema[] = [];
  @Input({ required: true }) state!: Map<string, WritableSignal<any>>;
  @Input() columns: ColumnInfo[] = [];
  @Input() isVisible: (param: DialogParamSchema) => boolean = () => true;

  /** Groups params by their `group` field. Ungrouped params come first. */
  get groups(): ParamGroup[] {
    const ungrouped: DialogParamSchema[] = [];
    const groupMap = new Map<string, DialogParamSchema[]>();

    for (const param of this.params) {
      if (param.group) {
        const list = groupMap.get(param.group) ?? [];
        list.push(param);
        groupMap.set(param.group, list);
      } else {
        ungrouped.push(param);
      }
    }

    const result: ParamGroup[] = [];
    if (ungrouped.length > 0) {
      result.push({ label: null, params: ungrouped });
    }
    for (const [label, params] of groupMap) {
      result.push({ label, params });
    }
    return result;
  }

  getSignal(name: string): WritableSignal<any> {
    const sig = this.state.get(name);
    if (!sig) {
      throw new Error(`[GenericFormSection] No signal for param "${name}"`);
    }
    return sig;
  }
}
