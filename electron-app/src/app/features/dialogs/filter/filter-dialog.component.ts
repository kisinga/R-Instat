import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import {
  FilterCondition,
  FilterOperator,
  CombineLogic,
  buildFilter,
  isConditionValid,
} from './filter-r-builders';
import { rSyntax } from '../../../core/r-codegen';

@Component({
  selector: 'app-filter-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, CodePreviewComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'FILTER.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          <select 
            class="select select-bordered w-full"
            [ngModel]="selectedDataframe()"
            (ngModelChange)="onDataframeChange($event)"
          >
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <!-- Filter Conditions -->
        <div class="form-group">
          <label class="form-label">{{ 'FILTER.CONDITIONS' | translate }}</label>
          
          @for (condition of conditions(); track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-end">
              <select 
                class="select select-bordered select-sm flex-1"
                [ngModel]="condition.column"
                (ngModelChange)="updateCondition(i, 'column', $event)"
              >
                <option value="">{{ 'DIALOG.SELECT_COLUMN' | translate }}</option>
                @for (col of columns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>

              <select 
                class="select select-bordered select-sm w-24"
                [ngModel]="condition.operator"
                (ngModelChange)="updateCondition(i, 'operator', $event)"
              >
                <option value="==">{{ 'FILTER.EQUALS' | translate }}</option>
                <option value="!=">{{ 'FILTER.NOT_EQUALS' | translate }}</option>
                <option value=">">{{ 'FILTER.GREATER_THAN' | translate }}</option>
                <option value=">=">{{ 'FILTER.GREATER_OR_EQUAL' | translate }}</option>
                <option value="<">{{ 'FILTER.LESS_THAN' | translate }}</option>
                <option value="<=">{{ 'FILTER.LESS_OR_EQUAL' | translate }}</option>
                <option value="%in%">{{ 'FILTER.IN' | translate }}</option>
                <option value="is.na">{{ 'FILTER.IS_NA' | translate }}</option>
                <option value="!is.na">{{ 'FILTER.IS_NOT_NA' | translate }}</option>
              </select>

              @if (condition.operator !== 'is.na' && condition.operator !== '!is.na') {
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  [placeholder]="'DIALOG.VALUE' | translate"
                  [ngModel]="condition.value"
                  (ngModelChange)="updateCondition(i, 'value', $event)"
                />
              }

              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeCondition(i)"
                [disabled]="conditions().length === 1"
              >
                ✕
              </button>
            </div>
          }

          <button class="btn btn-ghost btn-sm" (click)="addCondition()">
            {{ 'FILTER.ADD_CONDITION' | translate }}
          </button>
        </div>

        <!-- Logic -->
        <div class="form-group">
          <label class="form-label">{{ 'FILTER.COMBINE_WITH' | translate }}</label>
          <div class="flex gap-4">
            <label class="label cursor-pointer gap-2">
              <input 
                type="radio" 
                class="radio radio-primary" 
                [value]="'&'"
                [checked]="combineLogic() === '&'"
                (change)="combineLogic.set('&')"
              />
              <span>{{ 'FILTER.AND' | translate }}</span>
            </label>
            <label class="label cursor-pointer gap-2">
              <input 
                type="radio" 
                class="radio radio-primary" 
                [value]="'|'"
                [checked]="combineLogic() === '|'"
                (change)="combineLogic.set('|')"
              />
              <span>{{ 'FILTER.OR' | translate }}</span>
            </label>
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ (showCodePreview() ? 'DIALOG.HIDE_CODE' : 'DIALOG.SHOW_CODE') | translate }}
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class FilterDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 'Filter Rows';

  conditions = signal<FilterCondition[]>([{ column: '', operator: '==', value: '' }]);
  combineLogic = signal<CombineLogic>('&');

  addCondition(): void {
    this.conditions.update(c => [...c, { column: '', operator: '==', value: '' }]);
  }

  removeCondition(index: number): void {
    this.conditions.update(c => c.filter((_, i) => i !== index));
  }

  updateCondition(index: number, field: 'column' | 'operator' | 'value', value: string): void {
    this.conditions.update(c => {
      const updated = [...c];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();

    this.initializeCodeManager(() => {
      const code = buildFilter({
        dataframe: this.selectedDataframe() || '',
        conditions: this.conditions(),
        combineLogic: this.combineLogic(),
      });
      return rSyntax().setBase(code);
    });

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.conditions();
      this.combineLogic();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.conditions().some(isConditionValid);
  }
}
