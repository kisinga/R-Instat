import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-rename-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
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
            [(selectedColumn)]="oldName"
          />
        </div>

        <!-- New Name -->
        <div class="form-group">
          <label class="form-label">New Name</label>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Enter new column name..."
            [(ngModel)]="newName"
          />
          <p class="form-hint">Use letters, numbers, and underscores. Start with a letter.</p>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
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
export class RenameDialogComponent extends DialogBase {
  readonly dialogTitle = 'Rename Column';

  oldName = '';
  newName = '';

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.oldName || !this.newName) return '# Select column and enter new name';

    return `renamed_data <- get_dataframe("${df}") %>%
  dplyr::rename(${this.newName} = ${this.oldName})

add_dataframe("${df}", renamed_data)`;
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.oldName || !this.newName) {
      return false;
    }
    // Check valid R column name
    return /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(this.newName);
  }
}
