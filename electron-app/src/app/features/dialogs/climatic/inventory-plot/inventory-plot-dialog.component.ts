/**
 * Inventory Plot Dialog Component
 * 
 * Dialog for creating data availability inventory plots (heatmaps).
 */

import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../../core/services/r.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { InventoryPlotOptions, DEFAULT_INVENTORY_OPTIONS } from '../utils/climatic-types';
import { buildInventoryPlot } from '../utils/climatic-r-builders';

@Component({
  selector: 'app-inventory-plot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content inventory-plot-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.INVENTORY_PLOT' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <div class="dialog-grid">
          <!-- Left Column: Data Selection -->
          <div class="data-selection">
            <!-- Dataframe Selection -->
            <div class="form-group">
              <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
              @if (dataframes().length === 0) {
                <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">
                  {{ 'DIALOG.NO_DATA' | translate }}
                </div>
              } @else {
                <select 
                  class="select select-bordered w-full select-sm"
                  [ngModel]="selectedDataframe()"
                  (ngModelChange)="onDataframeChange($event)"
                >
                  @for (df of dataframes(); track df) {
                    <option [value]="df">{{ df }}</option>
                  }
                </select>
              }
            </div>

            <!-- Date Column -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.DATE_COLUMN' | translate }}</label>
              <app-column-picker
                [columns]="getDateColumns()"
                [multiple]="false"
                [selectedColumn]="dateColumn()"
                (selectedColumnChange)="dateColumn.set($event)"
              />
            </div>

            <!-- Element Column -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.ELEMENT_COLUMN' | translate }}</label>
              <app-column-picker
                [columns]="getNumericColumns()"
                [multiple]="false"
                [selectedColumn]="elementColumn()"
                (selectedColumnChange)="elementColumn.set($event)"
              />
            </div>

            <!-- Station Column (optional) -->
            <div class="form-group">
              <label class="form-label">
                {{ 'CLIMATIC.STATION_COLUMN' | translate }}
                <span class="text-xs text-base-content/50">({{ 'DIALOG.OPTIONAL' | translate }})</span>
              </label>
              <app-column-picker
                [columns]="getFactorColumns()"
                [multiple]="false"
                [selectedColumn]="stationColumn()"
                (selectedColumnChange)="stationColumn.set($event)"
              />
            </div>
          </div>

          <!-- Right Column: Plot Options -->
          <div class="plot-options">
            <!-- Title -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.PLOT_TITLE' | translate }}</label>
              <input 
                type="text" 
                class="input input-bordered w-full input-sm" 
                [(ngModel)]="plotTitle"
                [placeholder]="'Data Availability Inventory'"
              />
            </div>

            <!-- Facet by Station -->
            <div class="form-group">
              <label class="cursor-pointer flex items-center gap-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary" 
                  [(ngModel)]="facetByStation"
                  [disabled]="!stationColumn()"
                />
                <span class="text-sm">{{ 'CLIMATIC.FACET_BY_STATION' | translate }}</span>
              </label>
            </div>

            <!-- Flip Coordinates -->
            <div class="form-group">
              <label class="cursor-pointer flex items-center gap-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary" 
                  [(ngModel)]="flipCoords"
                />
                <span class="text-sm">{{ 'CLIMATIC.FLIP_COORDS' | translate }}</span>
              </label>
            </div>

            <!-- Colors -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.COLORS' | translate }}</label>
              <div class="flex gap-4">
                <div class="flex items-center gap-2">
                  <input 
                    type="color" 
                    class="w-8 h-8 rounded cursor-pointer"
                    [(ngModel)]="presentColor"
                  />
                  <span class="text-xs">{{ 'CLIMATIC.PRESENT' | translate }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input 
                    type="color" 
                    class="w-8 h-8 rounded cursor-pointer"
                    [(ngModel)]="missingColor"
                  />
                  <span class="text-xs">{{ 'CLIMATIC.MISSING' | translate }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Code Preview -->
        <div class="code-preview-section mt-4">
          <button 
            class="btn btn-ghost btn-xs gap-1"
            (click)="showCodePreview.set(!showCodePreview())"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {{ showCodePreview() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          
          @if (showCodePreview()) {
            <pre class="code-block mt-2">{{ rCode() }}</pre>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="reset()">{{ 'DIALOG.RESET' | translate }}</button>
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
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .inventory-plot-dialog {
      width: 600px;
      max-width: 90vw;
    }

    .dialog-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .data-selection {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border-right: 1px solid hsl(var(--b3));
      padding-right: 1.5rem;
    }

    .plot-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .code-block {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.7rem;
      overflow-x: auto;
      max-height: 150px;
      white-space: pre-wrap;
    }

    .code-preview-section {
      border-top: 1px solid hsl(var(--b3));
      padding-top: 0.75rem;
    }
  `]
})
export class InventoryPlotDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly languageService = inject(LanguageService);
  private readonly climaticService = inject(ClimaticDataService);

  // Data
  dataframes = signal<string[]>([]);
  selectedDataframe = signal<string>('');
  columns = signal<ColumnInfo[]>([]);

  // Form state (signals for reactivity with computed)
  dateColumn = signal('');
  elementColumn = signal('');
  stationColumn = signal('');
  plotTitle = '';
  facetByStation = DEFAULT_INVENTORY_OPTIONS.facetByStation!;
  flipCoords = DEFAULT_INVENTORY_OPTIONS.flipCoords!;
  presentColor = DEFAULT_INVENTORY_OPTIONS.presentColor!;
  missingColor = DEFAULT_INVENTORY_OPTIONS.missingColor!;

  // UI state
  isLoading = signal(false);
  showCodePreview = signal(false);

  // Computed
  rCode = computed(() => {
    const opts: InventoryPlotOptions = {
      dataframe: this.selectedDataframe(),
      dateColumn: this.dateColumn(),
      elementColumn: this.elementColumn(),
      stationColumn: this.stationColumn() || undefined,
      facetByStation: this.facetByStation && !!this.stationColumn(),
      flipCoords: this.flipCoords,
      title: this.plotTitle || undefined,
      presentColor: this.presentColor,
      missingColor: this.missingColor,
    };
    return buildInventoryPlot(opts);
  });

  isValid = computed(() => {
    return !!(
      this.selectedDataframe() &&
      this.dateColumn() &&
      this.elementColumn()
    );
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
    } else if (dfs.length > 0) {
      this.selectedDataframe.set(dfs[0]);
      await this.loadColumns();
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
      
      // Auto-fill from saved climatic roles
      this.autoFillFromRoles();
    } catch (error) {
      console.error('Failed to load columns:', error);
      this.columns.set([]);
    }
  }

  private autoFillFromRoles(): void {
    const df = this.selectedDataframe();
    if (!df) return;

    const roles = this.climaticService.getRoles(df);
    if (roles.date && !this.dateColumn()) {
      this.dateColumn.set(roles.date);
    }
    if (roles.rain && !this.elementColumn()) {
      this.elementColumn.set(roles.rain);
    }
    if (roles.station && !this.stationColumn()) {
      this.stationColumn.set(roles.station);
    }
  }

  async onDataframeChange(name: string): Promise<void> {
    this.selectedDataframe.set(name);
    this.dateColumn.set('');
    this.elementColumn.set('');
    this.stationColumn.set('');
    await this.loadColumns();
  }

  getDateColumns(): ColumnInfo[] {
    // Include Date types directly, and character columns that look like dates
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      const name = c.name.toLowerCase();
      
      // Always include actual Date/POSIXt types
      if (t.includes('date') || t.includes('posix')) {
        return true;
      }
      
      // For character columns, only include if name suggests it's a date
      if (t.includes('character')) {
        return name.includes('date') || name.includes('time') || name === 'day';
      }
      
      return false;
    });
  }

  getNumericColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('numeric') || t.includes('integer') || t.includes('double');
    });
  }

  getFactorColumns(): ColumnInfo[] {
    return this.columns().filter(c => {
      const t = c.type.toLowerCase();
      return t.includes('factor') || t.includes('character');
    });
  }

  reset(): void {
    this.dateColumn.set('');
    this.elementColumn.set('');
    this.stationColumn.set('');
    this.plotTitle = '';
    this.facetByStation = DEFAULT_INVENTORY_OPTIONS.facetByStation!;
    this.flipCoords = DEFAULT_INVENTORY_OPTIONS.flipCoords!;
    this.presentColor = DEFAULT_INVENTORY_OPTIONS.presentColor!;
    this.missingColor = DEFAULT_INVENTORY_OPTIONS.missingColor!;
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
        this.toastService.success(this.languageService.instant('TOAST.COMMAND_SUCCESS'));
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
