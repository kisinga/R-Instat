/**
 * GenericFormSectionComponent — Composable form section
 *
 * Renders a list of DialogParamSchema entries as form fields.
 * Column-kind params are auto-wrapped in a ColumnSelector with ColumnSlots.
 * Non-column params render via GenericFieldComponent.
 *
 * Grouping: params with a `group` field are rendered under a collapsible heading.
 * Ungrouped params render first, then each group in order of first appearance.
 */

import { Component, Input, type WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { DialogParamSchema } from '../../../../core/ai/dialog-schema.registry';
import type { ColumnInfo } from '../../../../core/models/r.model';
import { GenericFieldComponent } from './generic-field.component';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../../shared/components/column-selector';

interface ParamGroup {
  label: string | null;
  params: DialogParamSchema[];
}

function isColumnKind(kind: string): boolean {
  return kind === 'column' || kind === 'column[]';
}

@Component({
  selector: 'app-generic-form-section',
  standalone: true,
  imports: [CommonModule, GenericFieldComponent, ColumnSelectorComponent, ColumnSlotComponent],
  template: `
    @for (group of groups; track group.label) {
      @if (group.label) {
        <details class="collapse collapse-arrow bg-base-200 rounded-lg mb-3" open>
          <summary class="collapse-title text-sm font-medium py-2 min-h-0">
            {{ group.label }}
          </summary>
          <div class="collapse-content px-2">
            <ng-container *ngTemplateOutlet="paramList; context: { $implicit: group.params }" />
          </div>
        </details>
      } @else {
        <ng-container *ngTemplateOutlet="paramList; context: { $implicit: group.params }" />
      }
    }

    <ng-template #paramList let-params>
      <!-- Column params wrapped in a selector -->
      @if (getColumnParams(params).length > 0) {
        <app-column-selector [columns]="columns">
          @for (param of getColumnParams(params); track param.name) {
            @if (isVisible(param)) {
              <app-column-slot
                [name]="param.name"
                [label]="param.label || formatLabel(param.name)"
                [filter]="param.filter"
                [required]="!!param.required"
                [multiple]="param.kind === 'column[]'"
                [column]="getSignal(param.name)()"
                (columnChange)="getSignal(param.name).set($event)"
                [columns]="param.kind === 'column[]' ? (getSignal(param.name)() || []) : []"
                (columnsChange)="getSignal(param.name).set($event)"
              />
            }
          }
        </app-column-selector>
      }
      <!-- Non-column params -->
      @for (param of getNonColumnParams(params); track param.name) {
        @if (isVisible(param)) {
          <app-generic-field
            [param]="param"
            [value]="getSignal(param.name)"
            [columns]="columns"
          />
        }
      }
    </ng-template>
  `,
})
export class GenericFormSectionComponent {
  @Input({ required: true }) params: DialogParamSchema[] = [];
  @Input({ required: true }) state!: Map<string, WritableSignal<any>>;
  @Input() columns: ColumnInfo[] = [];
  @Input() isVisible: (param: DialogParamSchema) => boolean = () => true;

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

  getColumnParams(params: DialogParamSchema[]): DialogParamSchema[] {
    return params.filter(p => isColumnKind(p.kind));
  }

  getNonColumnParams(params: DialogParamSchema[]): DialogParamSchema[] {
    return params.filter(p => !isColumnKind(p.kind));
  }

  getSignal(name: string): WritableSignal<any> {
    const sig = this.state.get(name);
    if (!sig) {
      throw new Error(`[GenericFormSection] No signal for param "${name}"`);
    }
    return sig;
  }

  formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();
  }
}
