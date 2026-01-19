/**
 * Merge Dialog Component
 * 
 * Dialog for merging/joining two dataframes using dplyr join functions.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { ColumnInfo } from '../../../core/models/r.model';

interface JoinType {
  id: string;
  name: string;
  description: string;
}

const JOIN_TYPES: JoinType[] = [
  { id: 'full_join', name: 'Full Join', description: 'Include all rows from both dataframes' },
  { id: 'left_join', name: 'Left Join', description: 'Include all rows from first dataframe' },
  { id: 'right_join', name: 'Right Join', description: 'Include all rows from second dataframe' },
  { id: 'inner_join', name: 'Inner Join', description: 'Include only matching rows' },
  { id: 'semi_join', name: 'Semi Join', description: 'Keep rows from first with match in second' },
  { id: 'anti_join', name: 'Anti Join', description: 'Keep rows from first without match in second' },
];

@Component({
  selector: 'app-merge-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content merge-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'MERGE.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <div class="dialog-body">
        @if (dataframes().length < 2) {
          <div class="alert alert-warning">
            <span>{{ 'MERGE.NEED_TWO_DATAFRAMES' | translate }}</span>
          </div>
        } @else {
          <div class="grid grid-cols-2 gap-4">
            <!-- First Dataframe -->
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.FIRST_DATAFRAME' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [(ngModel)]="firstDataframe" (ngModelChange)="onFirstDataframeChange($event)">
                @for (df of dataframes(); track df) {
                  <option [value]="df" [disabled]="df === secondDataframe">{{ df }}</option>
                }
              </select>
            </div>

            <!-- Second Dataframe -->
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.SECOND_DATAFRAME' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [(ngModel)]="secondDataframe" (ngModelChange)="onSecondDataframeChange($event)">
                @for (df of dataframes(); track df) {
                  <option [value]="df" [disabled]="df === firstDataframe">{{ df }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Join Type -->
          <div class="form-group mt-4">
            <label class="form-label">{{ 'MERGE.JOIN_TYPE' | translate }}</label>
            <select class="select select-bordered w-full" [(ngModel)]="joinType">
              @for (type of joinTypes; track type.id) {
                <option [value]="type.id">{{ type.name }} - {{ type.description }}</option>
              }
            </select>
          </div>

          <!-- Join Columns -->
          <div class="grid grid-cols-2 gap-4 mt-4">
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.JOIN_COLUMN_1' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [(ngModel)]="joinColumn1">
                <option value="">-- {{ 'MERGE.SELECT_COLUMN' | translate }} --</option>
                @for (col of firstColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">{{ 'MERGE.JOIN_COLUMN_2' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [(ngModel)]="joinColumn2">
                <option value="">-- {{ 'MERGE.SELECT_COLUMN' | translate }} --</option>
                @for (col of secondColumns(); track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Result Name -->
          <div class="form-group mt-4">
            <label class="form-label">{{ 'MERGE.RESULT_NAME' | translate }}</label>
            <input type="text" class="input input-bordered w-full" [(ngModel)]="resultName" placeholder="merged_data" />
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
        }
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .merge-dialog { width: 600px; max-width: 90vw; }
    .code-block { 
      background: hsl(var(--b2)); 
      border-radius: 0.5rem; 
      padding: 0.75rem; 
      font-family: monospace; 
      font-size: 0.75rem; 
      overflow-x: auto; 
      max-height: 120px; 
      white-space: pre-wrap; 
    }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class MergeDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);

  dataframes = signal<string[]>([]);
  firstDataframe = '';
  secondDataframe = '';
  firstColumns = signal<ColumnInfo[]>([]);
  secondColumns = signal<ColumnInfo[]>([]);
  joinType = 'left_join';
  joinColumn1 = '';
  joinColumn2 = '';
  resultName = 'merged_data';
  
  isLoading = signal(false);
  showCode = signal(false);

  readonly joinTypes = JOIN_TYPES;

  rCode = computed(() => {
    if (!this.firstDataframe || !this.secondDataframe) {
      return '# Select two dataframes';
    }
    
    let code = `${this.resultName || 'merged_data'} <- dplyr::${this.joinType}(\n`;
    code += `  get_dataframe("${this.firstDataframe}"),\n`;
    code += `  get_dataframe("${this.secondDataframe}")`;
    
    if (this.joinColumn1 && this.joinColumn2) {
      if (this.joinColumn1 === this.joinColumn2) {
        code += `,\n  by = "${this.joinColumn1}"`;
      } else {
        code += `,\n  by = c("${this.joinColumn1}" = "${this.joinColumn2}")`;
      }
    }
    
    code += '\n)';
    code += `\ndata_store[["${this.resultName || 'merged_data'}"]] <- ${this.resultName || 'merged_data'}`;
    
    return code;
  });

  get isValid(): boolean {
    return !!(
      this.firstDataframe && 
      this.secondDataframe && 
      this.firstDataframe !== this.secondDataframe &&
      this.resultName
    );
  }

  async ngOnInit(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);
    
    if (dfs.length >= 2) {
      this.firstDataframe = dfs[0];
      this.secondDataframe = dfs[1];
      await this.loadFirstColumns();
      await this.loadSecondColumns();
    }
  }

  async onFirstDataframeChange(name: string): Promise<void> {
    this.firstDataframe = name;
    this.joinColumn1 = '';
    await this.loadFirstColumns();
  }

  async onSecondDataframeChange(name: string): Promise<void> {
    this.secondDataframe = name;
    this.joinColumn2 = '';
    await this.loadSecondColumns();
  }

  private async loadFirstColumns(): Promise<void> {
    if (!this.firstDataframe) { this.firstColumns.set([]); return; }
    try {
      const cols = await this.rService.getColumnInfo(this.firstDataframe);
      this.firstColumns.set(cols);
    } catch { this.firstColumns.set([]); }
  }

  private async loadSecondColumns(): Promise<void> {
    if (!this.secondDataframe) { this.secondColumns.set([]); return; }
    try {
      const cols = await this.rService.getColumnInfo(this.secondDataframe);
      this.secondColumns.set(cols);
    } catch { this.secondColumns.set([]); }
  }

  async execute(): Promise<void> {
    if (!this.isValid) {
      this.toastService.warning(this.languageService.instant('TOAST.FORM_INCOMPLETE'));
      return;
    }

    this.isLoading.set(true);

    try {
      const result = await this.rService.execute(this.rCode(), true);

      if (result.success) {
        await this.rService.refreshDataframes();
        this.toastService.success(this.languageService.instant('MERGE.SUCCESS'));
        this.close.emit();
      } else {
        this.toastService.error(result.error || this.languageService.instant('TOAST.COMMAND_FAILED'));
      }
    } catch (error) {
      this.toastService.error(
        error instanceof Error ? error.message : this.languageService.instant('TOAST.COMMAND_FAILED')
      );
    } finally {
      this.isLoading.set(false);
    }
  }
}
