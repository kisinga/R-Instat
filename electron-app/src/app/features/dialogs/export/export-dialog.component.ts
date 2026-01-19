/**
 * Export Dialog Component
 * 
 * Dialog for exporting dataframes to various file formats (CSV, Excel, RDS).
 * Uses rio::export() for R backend.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';

interface ExportFormat {
  id: string;
  name: string;
  extension: string;
  filter: { name: string; extensions: string[] };
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'csv', name: 'CSV (Comma Separated)', extension: 'csv', filter: { name: 'CSV Files', extensions: ['csv'] } },
  { id: 'xlsx', name: 'Excel (.xlsx)', extension: 'xlsx', filter: { name: 'Excel Files', extensions: ['xlsx'] } },
  { id: 'rds', name: 'R Data (.rds)', extension: 'rds', filter: { name: 'R Data Files', extensions: ['rds'] } },
  { id: 'tsv', name: 'TSV (Tab Separated)', extension: 'tsv', filter: { name: 'TSV Files', extensions: ['tsv'] } },
];

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content export-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'EXPORT.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          @if (dataframes().length === 0) {
            <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
              {{ 'DIALOG.NO_DATA' | translate }}
            </div>
          } @else {
            <select class="select select-bordered w-full" [ngModel]="selectedDataframe()" (ngModelChange)="selectedDataframe.set($event)">
              @for (df of dataframes(); track df) {
                <option [value]="df">{{ df }}</option>
              }
            </select>
          }
        </div>

        <!-- Format Selection -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'EXPORT.FORMAT' | translate }}</label>
          <select class="select select-bordered w-full" [ngModel]="selectedFormat()" (ngModelChange)="selectedFormat.set($event)">
            @for (format of formats; track format.id) {
              <option [value]="format.id">{{ format.name }}</option>
            }
          </select>
        </div>

        <!-- File Path -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'EXPORT.FILE_PATH' | translate }}</label>
          <div class="flex gap-2">
            <input 
              type="text" 
              class="input input-bordered flex-1" 
              [value]="filePath()"
              [placeholder]="'EXPORT.SELECT_FILE' | translate"
              readonly
            />
            <button class="btn btn-outline" (click)="browseFile()">
              {{ 'EXPORT.BROWSE' | translate }}
            </button>
          </div>
        </div>

        <!-- Code Preview -->
        <div class="code-preview-section mt-4">
          <button class="btn btn-ghost btn-xs gap-1" (click)="showCode.set(!showCode())">
            {{ showCode() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          @if (showCode()) {
            <pre class="code-block mt-2">{{ rCode() }}</pre>
          }
        </div>
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'EXPORT.EXPORT' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .export-dialog { width: 500px; max-width: 90vw; }
    .code-block { 
      background: hsl(var(--b2)); 
      border-radius: 0.5rem; 
      padding: 0.75rem; 
      font-family: monospace; 
      font-size: 0.75rem; 
      overflow-x: auto; 
      max-height: 100px; 
      white-space: pre-wrap; 
    }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class ExportDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  dataframes = signal<string[]>([]);
  selectedDataframe = signal('');
  selectedFormat = signal('csv');
  filePath = signal('');
  
  isLoading = signal(false);
  showCode = signal(false);

  readonly formats = EXPORT_FORMATS;

  rCode = computed(() => {
    const df = this.selectedDataframe();
    const path = this.filePath();
    if (!df || !path) {
      return '# Select dataframe and file path';
    }
    // Escape backslashes for Windows paths
    const escapedPath = path.replace(/\\/g, '/');
    return `rio::export(get_dataframe("${df}"), "${escapedPath}")`;
  });

  isValid = computed(() => !!(this.selectedDataframe() && this.filePath()));

  async ngOnInit(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);
    
    const active = this.rService.activeDataframe();
    if (active && dfs.includes(active)) {
      this.selectedDataframe.set(active);
    } else if (dfs.length > 0) {
      this.selectedDataframe.set(dfs[0]);
    }
  }

  async browseFile(): Promise<void> {
    if (!window.electronAPI?.dialog?.saveFile) {
      this.toastService.warning(this.languageService.instant('TOAST.FILE_BROWSER_NA'));
      return;
    }

    const format = this.formats.find(f => f.id === this.selectedFormat());
    const df = this.selectedDataframe();
    const defaultName = df 
      ? `${df}.${format?.extension || 'csv'}`
      : `export.${format?.extension || 'csv'}`;

    try {
      const result = await window.electronAPI.dialog.saveFile({
        title: this.languageService.instant('EXPORT.SELECT_FILE'),
        defaultPath: defaultName,
        filters: format ? [format.filter, { name: 'All Files', extensions: ['*'] }] : undefined,
      });

      if (!result.canceled && result.filePath) {
        this.filePath.set(result.filePath);
      }
    } catch (error) {
      console.error('Failed to open save dialog:', error);
      this.toastService.error(this.languageService.instant('TOAST.FILE_BROWSER_FAILED'));
    }
  }

  async execute(): Promise<void> {
    if (!this.isValid()) {
      this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE'));
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(this.rCode());

      if (result.success) {
        this.toastService.success(
          this.languageService.instant('EXPORT.SUCCESS', { path: this.filePath() })
        );
        this.close.emit();
      } else {
        this.toastService.error(result.error || this.languageService.instant('EXPORT.FAILED'));
      }
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : this.languageService.instant('EXPORT.FAILED')
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
