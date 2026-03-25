import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildRename } from '../../../core/dialogs/builders/data-manipulation';
import type { DialogContract } from '../../../core/ai/dialog-catalog';
import { p } from '../../../core/ai/dialog-schema.registry';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';

@Component({
  selector: 'app-rename-dialog',
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

        <!-- Column Selection -->
        <div class="form-group">
          <label class="form-label">Column to Rename</label>
          <app-column-picker
            [columns]="columns()"
            [multiple]="false"
            [selectedColumn]="oldName()"
            (selectedColumnChange)="oldName.set($event)"
          />
        </div>

        <!-- New Name -->
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Enter new column name..."
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
          />
          <p class="form-hint">Use letters, numbers, and underscores. Start with a letter.</p>
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
export class RenameDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(RenameDialogComponent); }
  static readonly dialogId = 'rename';

  static override getCatalogDescriptor(): DialogContract {
    return {
      dialogId: 'rename',
      componentType: 'RenameDialogComponent',
      title: 'Rename Column',
      family: 'data-preparation',
      description: 'Rename one column.',
      operations: ['data.rename'],
      params: [
        p('dataframe', 'dataframe', { required: true }),
        p('oldName', 'column', { required: true, columnType: 'any' }),
        p('newName', 'string', { required: true }),
      ],
      retrievalHints: {
        keywords: ['rename', 'rename column', 'column name', 'relabel'],
      },
    };
  }

  // Dialog state using signals for reactivity
  oldName = signal('');
  newName = signal('');

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      oldName: this.oldName,
      newName: this.newName,
    });

    // Initialize code manager with builder function
    this.initializeCodeManager(() =>
      buildRename({
        dataframe: this.selectedDataframe(),
        oldName: this.oldName(),
        newName: this.newName(),
      })
    );

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.oldName();
      this.newName();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.oldName() || !this.newName()) {
      return false;
    }
    // Check valid R column name
    return /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(this.newName());
  }
}
