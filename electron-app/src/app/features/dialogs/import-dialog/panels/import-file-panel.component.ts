import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-import-file-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="panel-content">
      <!-- File Selection -->
      <div class="form-group">
        <label class="form-label">File Path</label>
        <div class="flex gap-2">
          <input
            type="text"
            class="input input-bordered flex-1"
            placeholder="Enter file path or use file picker..."
            [(ngModel)]="filePath"
          />
          <button class="btn btn-outline" (click)="selectFile()">
            Browse...
          </button>
        </div>
        <p class="form-hint">Supported formats: CSV, TSV, Excel (.xlsx, .xls)</p>
      </div>

      <!-- Data Name -->
      <div class="form-group">
        <label class="form-label">Data Name</label>
        <input
          type="text"
          class="input input-bordered w-full"
          placeholder="Enter name for the imported data..."
          [(ngModel)]="dataName"
        />
      </div>

      <!-- CSV Options -->
      <div class="collapse collapse-arrow bg-base-200/60 rounded-lg border border-base-300">
        <input type="checkbox" />
        <div class="collapse-title font-medium text-sm py-3">
          Advanced Options
        </div>
        <div class="collapse-content">
          <div class="grid grid-cols-2 gap-4 pt-2">
            <div class="form-group">
              <label class="form-label text-sm">Separator</label>
              <select class="select select-bordered select-sm w-full" [(ngModel)]="separator">
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="\t">Tab</option>
                <option value=" ">Space</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label text-sm">Decimal</label>
              <select class="select select-bordered select-sm w-full" [(ngModel)]="decimal">
                <option value=".">Period (.)</option>
                <option value=",">Comma (,)</option>
              </select>
            </div>

            <div class="form-group col-span-2">
              <label class="label cursor-pointer justify-start gap-2 py-0">
                <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" [(ngModel)]="hasHeader" />
                <span class="text-sm">First row contains column names</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Code Preview -->
      <div 
        class="code-preview-wrapper"
        [class.expanded]="showCodePreview()"
      >
        @if (showCodePreview()) {
          <div class="form-group animate-fade-in">
            <label class="form-label text-sm">R Code Preview</label>
            <pre class="code-block text-xs">{{ buildRCode() }}</pre>
          </div>
        }
      </div>

      <!-- Spacer to push actions to bottom -->
      <div class="flex-grow"></div>

      <!-- Actions -->
      <div class="panel-actions">
        <button class="btn btn-ghost btn-sm gap-1" (click)="toggleCodePreview()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <button 
          class="btn btn-primary" 
          (click)="importFile()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          Import
        </button>
      </div>
    </div>
  `,
  styles: [`
    .panel-content {
      display: flex;
      flex-direction: column;
      min-height: 340px;
    }

    .form-group {
      margin-bottom: 1rem;
    }

    .code-preview-wrapper {
      overflow: hidden;
      transition: max-height 200ms ease-out;
      max-height: 0;
    }

    .code-preview-wrapper.expanded {
      max-height: 120px;
    }

    .animate-fade-in {
      animation: fadeIn 200ms ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .panel-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1rem;
      margin-top: auto;
      border-top: 1px solid oklch(var(--bc) / 0.1);
    }
  `]
})
export class ImportFilePanelComponent {
  @Output() imported = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);

  filePath = '';
  dataName = '';
  separator = ',';
  decimal = '.';
  hasHeader = true;
  
  isLoading = signal(false);
  showCodePreview = signal(false);

  async selectFile(): Promise<void> {
    if (!window.electronAPI?.dialog) {
      this.toastService.error('File browser not available');
      return;
    }

    try {
      const result = await window.electronAPI.dialog.openFile({
        title: 'Select Data File to Import',
      });

      if (!result.canceled && result.filePaths.length > 0) {
        this.filePath = result.filePaths[0];
        
        // Auto-populate data name from filename
        if (!this.dataName) {
          const fileName = this.filePath.split(/[/\\]/).pop() || 'data';
          this.dataName = fileName
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9_]/g, '_');
        }
      }
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      this.toastService.error('Failed to open file browser');
    }
  }

  toggleCodePreview(): void {
    this.showCodePreview.update(v => !v);
  }

  buildRCode(): string {
    const name = this.dataName || 'imported_data';
    const path = this.filePath.replace(/\\/g, '/');

    if (path.endsWith('.csv') || path.endsWith('.tsv') || path.endsWith('.txt')) {
      return `${name} <- read.csv("${path}", sep = "${this.separator}", dec = "${this.decimal}", header = ${this.hasHeader ? 'TRUE' : 'FALSE'})
add_dataframe("${name}", ${name})`;
    } else if (path.endsWith('.xlsx') || path.endsWith('.xls')) {
      return `${name} <- readxl::read_excel("${path}")
add_dataframe("${name}", ${name})`;
    }

    return `# Unsupported file format
# Please use CSV, TSV, or Excel files`;
  }

  isValid(): boolean {
    return this.filePath.trim().length > 0;
  }

  async importFile(): Promise<void> {
    if (!this.isValid()) {
      this.toastService.warning('Please enter a file path');
      return;
    }

    // Auto-generate data name from file if not provided
    if (!this.dataName && this.filePath) {
      const fileName = this.filePath.split(/[/\\]/).pop() || 'data';
      this.dataName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
    }

    const code = this.buildRCode();
    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(code);
      
      if (!result.success) {
        this.toastService.error(result.error || 'Import failed');
        return;
      }
      
      this.toastService.success('Data imported successfully');
      this.imported.emit();
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : 'Failed to import data'
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
