import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import {
  FilterCondition,
  FilterOperator,
  CombineLogic,
  buildFilter,
  isConditionValid,
} from './filter-r-builders';

@Component({
  selector: 'app-filter-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
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
          
          @for (condition of conditions; track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-end">
              <select 
                class="select select-bordered select-sm flex-1"
                [(ngModel)]="condition.column"
              >
                <option value="">{{ 'DIALOG.SELECT_COLUMN' | translate }}</option>
                @for (col of columns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>

              <select 
                class="select select-bordered select-sm w-24"
                [(ngModel)]="condition.operator"
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
                  [(ngModel)]="condition.value"
                />
              }

              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeCondition(i)"
                [disabled]="conditions.length === 1"
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
              <input type="radio" class="radio radio-primary" [(ngModel)]="combineLogic" value="&" />
              <span>{{ 'FILTER.AND' | translate }}</span>
            </label>
            <label class="label cursor-pointer gap-2">
              <input type="radio" class="radio radio-primary" [(ngModel)]="combineLogic" value="|" />
              <span>{{ 'FILTER.OR' | translate }}</span>
            </label>
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">{{ 'DIALOG.CODE_PREVIEW' | translate }}</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
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
export class FilterDialogComponent extends DialogBase {
  readonly dialogTitle = 'Filter Rows';

  conditions: FilterCondition[] = [{ column: '', operator: '==', value: '' }];
  combineLogic: CombineLogic = '&';

  addCondition(): void {
    this.conditions = [...this.conditions, { column: '', operator: '==', value: '' }];
  }

  removeCondition(index: number): void {
    this.conditions = this.conditions.filter((_, i) => i !== index);
  }

  buildRCode(): string {
    return buildFilter({
      dataframe: this.selectedDataframe() || '',
      conditions: this.conditions,
      combineLogic: this.combineLogic,
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && this.conditions.some(isConditionValid);
  }
}
