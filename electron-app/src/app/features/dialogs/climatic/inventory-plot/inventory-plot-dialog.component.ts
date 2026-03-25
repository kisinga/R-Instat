/**
 * Inventory Plot Dialog Component
 * 
 * Dialog for creating data availability inventory plots (heatmaps).
 */

import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../../dialog-base';
import { AIDialogClassRegistry } from '../../../../core/ai/dialog-class-registry';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnInfo } from '../../../../core/models/r.model';
import { ColumnPickerComponent } from '../../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../../shared/components/code-preview/code-preview.component';
import { InventoryPlotOptions, DEFAULT_INVENTORY_OPTIONS } from '../utils/climatic-types';
import { buildInventoryPlot } from '../utils/climatic-r-builders';
import { rSyntax, rAssign } from '../../../../core/r-codegen';
import { mapClimaticRolesToFields } from '../utils/climatic-role-mapper';

@Component({
  selector: 'app-inventory-plot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content inventory-plot-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.INVENTORY_PLOT' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
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
                [ngModel]="plotTitle()"
                (ngModelChange)="plotTitle.set($event)"
                [placeholder]="'Data Availability Inventory'"
              />
            </div>

            <!-- Facet by Station -->
            <div class="form-group">
              <label class="cursor-pointer flex items-center gap-2">
                <input 
                  type="checkbox" 
                  class="checkbox checkbox-sm checkbox-primary" 
                  [checked]="facetByStation()"
                  (change)="facetByStation.set($any($event.target).checked)"
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
                  [checked]="flipCoords()"
                  (change)="flipCoords.set($any($event.target).checked)"
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
                    [ngModel]="presentColor()"
                    (ngModelChange)="presentColor.set($event)"
                  />
                  <span class="text-xs">{{ 'CLIMATIC.PRESENT' | translate }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <input 
                    type="color" 
                    class="w-8 h-8 rounded cursor-pointer"
                    [ngModel]="missingColor()"
                    (ngModelChange)="missingColor.set($event)"
                  />
                  <span class="text-xs">{{ 'CLIMATIC.MISSING' | translate }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="reset()">{{ 'DIALOG.RESET' | translate }}</button>
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
  styles: [`
    .inventory-plot-dialog {
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
export class InventoryPlotDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(InventoryPlotDialogComponent); }

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  elementColumn = signal('');
  stationColumn = signal('');
  plotTitle = signal('');
  facetByStation = signal(DEFAULT_INVENTORY_OPTIONS.facetByStation!);
  flipCoords = signal(DEFAULT_INVENTORY_OPTIONS.flipCoords!);
  presentColor = signal(DEFAULT_INVENTORY_OPTIONS.presentColor!);
  missingColor = signal(DEFAULT_INVENTORY_OPTIONS.missingColor!);

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      dateColumn: this.dateColumn,
      elementColumn: this.elementColumn,
      stationColumn: this.stationColumn,
      plotTitle: this.plotTitle,
      facetByStation: this.facetByStation,
      flipCoords: this.flipCoords,
      presentColor: this.presentColor,
      missingColor: this.missingColor,
    });

    // Register auto-population source from climatic roles
    this.registerAutoPopulateSource(() => {
      const df = this.selectedDataframe();
      if (!df) return null;
      return mapClimaticRolesToFields(
        this.climaticService.getRoles(df),
        {
          dateColumn: 'date',
          elementColumn: (r) => r.rain || r.element,
          stationColumn: 'station',
        }
      );
    });

    // Initialize code manager with builder
    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return rSyntax().setBase('# Select a dataframe first');
      }

      const opts: InventoryPlotOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        elementColumn: this.elementColumn(),
        stationColumn: this.stationColumn() || undefined,
        facetByStation: this.facetByStation() && !!this.stationColumn(),
        flipCoords: this.flipCoords(),
        title: this.plotTitle() || undefined,
        presentColor: this.presentColor(),
        missingColor: this.missingColor(),
      };
      
      const syntax = rSyntax().setBase(buildInventoryPlot(opts));
      
      // Set assignment for graph output
      return syntax.setAssignment(
        rAssign('graph', 'inventory_plot', {
          format: 'text',
        })
      );
    });

    // Reactive updates
    this.createEffect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.elementColumn();
      this.stationColumn();
      this.plotTitle();
      this.facetByStation();
      this.flipCoords();
      this.presentColor();
      this.missingColor();
      this.rebuildRCode();
    });
  }

  // Enhanced date column detection (includes character columns with date-like names)
  override getDateColumns(): ColumnInfo[] {
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

  reset(): void {
    this.dateColumn.set('');
    this.elementColumn.set('');
    this.stationColumn.set('');
    this.plotTitle.set('');
    this.facetByStation.set(DEFAULT_INVENTORY_OPTIONS.facetByStation!);
    this.flipCoords.set(DEFAULT_INVENTORY_OPTIONS.flipCoords!);
    this.presentColor.set(DEFAULT_INVENTORY_OPTIONS.presentColor!);
    this.missingColor.set(DEFAULT_INVENTORY_OPTIONS.missingColor!);
  }

  isValid(): boolean {
    return !!(
      this.selectedDataframe() &&
      this.dateColumn() &&
      this.elementColumn()
    );
  }
}
