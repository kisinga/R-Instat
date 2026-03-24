import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildRecode } from '../../../core/dialogs/builders/data-manipulation';
import type { DialogPromptContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

interface RecodeMapping {
  from: string;
  to: string;
}

@Component({
  selector: 'app-recode-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">Data Frame</label>
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

        <!-- Column to Recode -->
        <div class="form-group">
          <label class="form-label">Column to Recode</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="false"
            [selectedColumn]="sourceColumn()"
            (selectedColumnChange)="sourceColumn.set($event)"
          />
        </div>

        <!-- New Column Name -->
        <div class="form-group">
          <label class="form-label">New Column Name (optional)</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Leave empty to overwrite original"
            [ngModel]="newColumnName()"
            (ngModelChange)="newColumnName.set($event)"
          />
        </div>

        <!-- Recode Mappings -->
        <div class="form-group">
          <label class="form-label">Recode Values</label>
          
          @for (mapping of mappings(); track $index; let i = $index) {
            <div class="flex gap-2 mb-2 items-center">
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="From value..."
                [ngModel]="mapping.from"
                (ngModelChange)="updateMapping(i, 'from', $event)"
              />
              <span class="text-base-content/50">→</span>
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="To value..."
                [ngModel]="mapping.to"
                (ngModelChange)="updateMapping(i, 'to', $event)"
              />
              <button 
                class="btn btn-ghost btn-sm btn-square"
                (click)="removeMapping(i)"
                [disabled]="mappings().length === 1"
              >
                ✕
              </button>
            </div>
          }

          <button class="btn btn-ghost btn-sm" (click)="addMapping()">
            + Add Mapping
          </button>
        </div>

        <!-- Default Value -->
        <div class="form-group">
          <label class="form-label">Default Value (for unmatched values)</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Leave empty to keep original value"
            [ngModel]="defaultValue()"
            (ngModelChange)="defaultValue.set($event)"
          />
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
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class RecodeDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(RecodeDialogComponent); }
  static readonly dialogId = 'recode';
  readonly dialogTitle = 'Recode Values';

  static override getCatalogDescriptor(): DialogPromptContract {
    return {
      dialogId: 'recode',
      componentType: 'RecodeDialogComponent',
      family: 'data-preparation',
      description: 'Recode values in a column (map old values to new).',
      operations: ['data.recode'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('sourceColumn', 'column', { required: true, columnType: 'any' }),
        p('newColumnName', 'string', { required: true }),
        p('mappings', 'object[]'),
        p('defaultValue', 'string'),
      ],
      retrievalHints: {
        keywords: ['recode', 'recode column', 'map', 'replace values', 'categorise'],
      },
    };
  }

  // Dialog state using signals for reactivity
  sourceColumn = signal('');
  newColumnName = signal('');
  mappings = signal<RecodeMapping[]>([{ from: '', to: '' }]);
  defaultValue = signal('');

  addMapping(): void {
    this.mappings.update(m => [...m, { from: '', to: '' }]);
  }

  removeMapping(index: number): void {
    this.mappings.update(m => m.filter((_, i) => i !== index));
  }

  updateMapping(index: number, field: 'from' | 'to', value: string): void {
    this.mappings.update(m => {
      const updated = [...m];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      sourceColumn: this.sourceColumn,
      newColumnName: this.newColumnName,
      mappings: this.mappings,
      defaultValue: this.defaultValue,
    });

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildRecode({
        dataframe: this.selectedDataframe(),
        sourceColumn: this.sourceColumn(),
        newColumnName: this.newColumnName() || undefined,
        mappings: this.mappings(),
        defaultValue: this.defaultValue() || undefined,
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.sourceColumn();
      this.newColumnName();
      this.mappings();
      this.defaultValue();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!this.selectedDataframe() && 
      !!this.sourceColumn() && 
      this.mappings().some(m => m.from && m.to);
  }
}
