/**
 * Define Climatic Data Dialog
 * 
 * Allows users to assign column roles for climatic analysis.
 * Auto-detects likely columns and allows manual override.
 * Triggers date conversion when needed.
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ClimaticDataService, ClimaticRoles, ClimaticColumnRole } from '../../../../core/services/climatic-data.service';
import { DateConversionService } from '../../../../core/services/date-conversion.service';
import { ColumnInfo } from '../../../../core/models/r.model';

interface RoleConfig {
  role: ClimaticColumnRole;
  labelKey: string;
  required: boolean;
  columnTypes?: string[];
}

const ROLE_CONFIGS: RoleConfig[] = [
  { role: 'date', labelKey: 'CLIMATIC.ROLE_DATE', required: true },
  { role: 'station', labelKey: 'CLIMATIC.ROLE_STATION', required: false, columnTypes: ['factor', 'character'] },
  { role: 'year', labelKey: 'CLIMATIC.ROLE_YEAR', required: false, columnTypes: ['numeric', 'integer'] },
  { role: 'month', labelKey: 'CLIMATIC.ROLE_MONTH', required: false, columnTypes: ['numeric', 'integer', 'factor'] },
  { role: 'doy', labelKey: 'CLIMATIC.ROLE_DOY', required: false, columnTypes: ['numeric', 'integer'] },
  { role: 'rain', labelKey: 'CLIMATIC.ROLE_RAIN', required: false, columnTypes: ['numeric', 'double'] },
  { role: 'tmax', labelKey: 'CLIMATIC.ROLE_TMAX', required: false, columnTypes: ['numeric', 'double'] },
  { role: 'tmin', labelKey: 'CLIMATIC.ROLE_TMIN', required: false, columnTypes: ['numeric', 'double'] },
];

@Component({
  selector: 'app-define-climatic-data-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content define-climatic-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.DEFINE_DATA' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <p class="text-sm text-base-content/70 mb-4">
          {{ 'CLIMATIC.DEFINE_DATA_DESC' | translate }}
        </p>

        <!-- Dataframe Selection -->
        <div class="form-group mb-4">
          <label class="form-label font-medium">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          @if (dataframes().length === 0) {
            <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
              {{ 'DIALOG.NO_DATA' | translate }}
            </div>
          } @else {
            <select 
              class="select select-bordered w-full"
              [ngModel]="selectedDataframe()"
              (ngModelChange)="onDataframeChange($event)"
            >
              @for (df of dataframes(); track df) {
                <option [value]="df">{{ df }}</option>
              }
            </select>
          }
        </div>

        <!-- Auto-detect button -->
        @if (selectedDataframe()) {
          <div class="flex gap-2 mb-4">
            <button 
              class="btn btn-outline btn-sm"
              (click)="autoDetect()"
              [disabled]="columns().length === 0"
            >
              {{ 'CLIMATIC.AUTO_DETECT' | translate }}
            </button>
            <button 
              class="btn btn-ghost btn-sm"
              (click)="clearRoles()"
            >
              {{ 'CLIMATIC.CLEAR_ROLES' | translate }}
            </button>
          </div>
        }

        <!-- Role Assignments -->
        @if (columns().length > 0) {
          <div class="role-grid">
            @for (config of roleConfigs; track config.role) {
              <div class="role-row">
                <label class="role-label">
                  {{ config.labelKey | translate }}
                  @if (config.required) {
                    <span class="text-error">*</span>
                  }
                </label>
                <select 
                  class="select select-bordered select-sm flex-1"
                  [ngModel]="roles()[config.role] || ''"
                  (ngModelChange)="setRole(config.role, $event)"
                >
                  <option value="">-- {{ 'CLIMATIC.SELECT_COLUMN' | translate }} --</option>
                  @for (col of getColumnsForRole(config); track col.name) {
                    <option [value]="col.name">{{ col.name }} ({{ col.type }})</option>
                  }
                </select>
              </div>
            }
          </div>
        }

        <!-- Status -->
        @if (isConverting()) {
          <div class="alert alert-info mt-4">
            <span class="loading loading-spinner loading-sm"></span>
            <span>{{ 'CLIMATIC.CONVERTING_DATE' | translate }}</span>
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <div class="flex-1">
          @if (climaticService.isConfigured(selectedDataframe())) {
            <span class="badge badge-success badge-sm">{{ 'CLIMATIC.CONFIGURED' | translate }}</span>
          }
        </div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button 
          class="btn btn-primary" 
          (click)="save()"
          [disabled]="!canSave() || isConverting()"
        >
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .define-climatic-dialog {
      width: 500px;
      max-width: 90vw;
    }

    .role-grid {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .role-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .role-label {
      width: 120px;
      font-size: 0.875rem;
      font-weight: 500;
    }
  `]
})
export class DefineClimaticDataDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  readonly climaticService = inject(ClimaticDataService);
  private readonly dateConversionService = inject(DateConversionService);

  // Data
  dataframes = signal<string[]>([]);
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);
  
  // State
  roles = signal<ClimaticRoles>({});
  isConverting = signal(false);

  // Config
  readonly roleConfigs = ROLE_CONFIGS;

  // Computed
  canSave = computed(() => {
    const r = this.roles();
    // At least date column should be set
    return !!r.date;
  });

  async ngOnInit(): Promise<void> {
    await this.loadDataframes();
  }

  private async loadDataframes(): Promise<void> {
    const dfs = this.rService.dataframes();
    this.dataframes.set(dfs);

    const active = this.rService.activeDataframe();
    if (active && dfs.includes(active)) {
      this.selectedDataframe.set(active);
      await this.loadColumns();
      this.loadExistingRoles();
    } else if (dfs.length > 0) {
      this.selectedDataframe.set(dfs[0]);
      await this.loadColumns();
      this.loadExistingRoles();
    }
  }

  private async loadColumns(): Promise<void> {
    const df = this.selectedDataframe();
    if (!df) {
      this.columns.set([]);
      return;
    }

    try {
      const columnInfo = await this.rService.getColumnInfo(df);
      this.columns.set(columnInfo);
    } catch (error) {
      console.error('Failed to load columns:', error);
      this.columns.set([]);
    }
  }

  private loadExistingRoles(): void {
    const df = this.selectedDataframe();
    if (df) {
      const existing = this.climaticService.getRoles(df);
      this.roles.set({ ...existing });
    }
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    this.roles.set({});
    await this.loadColumns();
    this.loadExistingRoles();
  }

  getColumnsForRole(config: RoleConfig): ColumnInfo[] {
    if (!config.columnTypes) {
      return this.columns();
    }
    
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return config.columnTypes!.some(ct => t.includes(ct));
    });
  }

  setRole(role: ClimaticColumnRole, column: string): void {
    const current = this.roles();
    if (column) {
      this.roles.set({ ...current, [role]: column });
    } else {
      const updated = { ...current };
      delete updated[role];
      this.roles.set(updated);
    }
  }

  autoDetect(): void {
    const columnNames = this.columns().map(c => c.name);
    const detected = this.climaticService.autoDetectRoles(columnNames);
    this.roles.set({ ...this.roles(), ...detected });
    
    const count = Object.keys(detected).length;
    if (count > 0) {
      this.toastService.info(
        this.languageService.instant('CLIMATIC.AUTO_DETECTED', { count })
      );
    }
  }

  clearRoles(): void {
    this.roles.set({});
  }

  async save(): Promise<void> {
    const df = this.selectedDataframe();
    const r = this.roles();
    
    if (!df || !r.date) {
      this.toastService.warning(this.languageService.instant('CLIMATIC.DATE_REQUIRED'));
      return;
    }

    // Save roles
    this.climaticService.setRoles(df, r);

    // Check if date column needs conversion
    const dateColumn = r.date;
    const needsConversion = await this.dateConversionService.needsConversion(df, dateColumn);
    
    if (needsConversion) {
      this.isConverting.set(true);
      
      const result = await this.dateConversionService.convertToDate(df, dateColumn);
      
      this.isConverting.set(false);
      
      if (result.success) {
        this.climaticService.markDateConverted(df);
        this.toastService.success(this.languageService.instant('CLIMATIC.DATE_CONVERTED'));
      } else {
        this.toastService.error(
          result.error || this.languageService.instant('CLIMATIC.CONVERSION_FAILED')
        );
        return;
      }
    }

    this.toastService.success(this.languageService.instant('CLIMATIC.ROLES_SAVED'));
    this.close.emit();
  }
}
