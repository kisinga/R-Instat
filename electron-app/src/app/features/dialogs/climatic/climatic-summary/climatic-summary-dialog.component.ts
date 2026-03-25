/**
 * Climatic Summary Dialog Component
 * 
 * Dialog for computing climatic summaries (annual/monthly totals, means, etc.)
 */

import { Component, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../../dialog-base';
import { AIDialogClassRegistry } from '../../../../core/ai/dialog-class-registry';
import { ClimaticDataService } from '../../../../core/services/climatic-data.service';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../../shared/components/column-selector';
import { CodePreviewComponent } from '../../../../shared/components/code-preview/code-preview.component';
import {
  ClimaticSummaryOptions,
  SummaryLevel,
  ClimaticSummaryFunction,
  SUMMARY_LEVELS,
  SUMMARY_FUNCTIONS,
  DEFAULT_SUMMARY_OPTIONS,
} from '../utils/climatic-types';
import { buildClimaticSummary } from '../utils/climatic-r-builders';
import { rSyntax } from '../../../../core/r-codegen';
import { mapClimaticRolesToFields } from '../utils/climatic-role-mapper';

@Component({
  selector: 'app-climatic-summary-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnSelectorComponent, ColumnSlotComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content climatic-summary-dialog" (click)="$event.stopPropagation()">
      <!-- Header -->
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.SUMMARY' | translate }}</h2>
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

            <app-column-selector [columns]="columns()">
              <app-column-slot name="dateColumn" [label]="'CLIMATIC.DATE_COLUMN' | translate"
                filter="date" [required]="true"
                [(column)]="dateColumn" />
              <app-column-slot name="elementColumn" [label]="'CLIMATIC.ELEMENT_COLUMN' | translate"
                filter="numeric" [required]="true"
                [(column)]="elementColumn" />
              <app-column-slot name="stationColumn" [label]="'CLIMATIC.STATION_COLUMN' | translate"
                filter="factor"
                [(column)]="stationColumn" />
            </app-column-selector>
          </div>

          <!-- Right Column: Options -->
          <div class="summary-options">
            <!-- Summary Level -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.SUMMARY_LEVEL' | translate }}</label>
              <div class="flex flex-wrap gap-2">
                @for (level of summaryLevels; track level.value) {
                  <label class="cursor-pointer flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="level"
                      class="radio radio-sm radio-primary"
                      [value]="level.value"
                      [checked]="summaryLevel() === level.value"
                      (change)="summaryLevel.set(level.value)"
                    />
                    <span class="text-sm">{{ level.labelKey | translate }}</span>
                  </label>
                }
              </div>
            </div>

            <!-- Summary Function -->
            <div class="form-group">
              <label class="form-label">{{ 'CLIMATIC.SUMMARY_FUNCTION' | translate }}</label>
              <select class="select select-bordered w-full select-sm" [ngModel]="summaryFunction()" (ngModelChange)="summaryFunction.set($event)">
                @for (func of summaryFunctions; track func.value) {
                  <option [value]="func.value">{{ func.labelKey | translate }}</option>
                }
              </select>
            </div>

            <!-- Omit Missing -->
            <div class="form-group">
              <label class="cursor-pointer flex items-center gap-2">
                <input type="checkbox" class="checkbox checkbox-sm checkbox-primary" [checked]="omitMissing()" (change)="omitMissing.set($any($event.target).checked)" />
                <span class="text-sm">{{ 'CLIMATIC.OMIT_MISSING' | translate }}</span>
              </label>
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
    .climatic-summary-dialog {
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

    .summary-options {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .code-block {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
      font-family: 'Fira Code', 'Monaco', monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      max-height: 120px;
      white-space: pre-wrap;
    }

    .code-preview-section {
      border-top: 1px solid hsl(var(--b3));
      padding-top: 0.75rem;
    }
  `]
})
export class ClimaticSummaryDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(ClimaticSummaryDialogComponent); }

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  elementColumn = signal('');
  stationColumn = signal('');
  summaryLevel = signal<SummaryLevel>(DEFAULT_SUMMARY_OPTIONS.level!);
  summaryFunction = signal<ClimaticSummaryFunction>(DEFAULT_SUMMARY_OPTIONS.summaryFunction!);
  omitMissing = signal(DEFAULT_SUMMARY_OPTIONS.omitMissing!);

  // Constants
  readonly summaryLevels = SUMMARY_LEVELS;
  readonly summaryFunctions = SUMMARY_FUNCTIONS;

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      dateColumn: this.dateColumn,
      elementColumn: this.elementColumn,
      stationColumn: this.stationColumn,
      summaryLevel: this.summaryLevel,
      summaryFunction: this.summaryFunction,
      omitMissing: this.omitMissing,
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

      const opts: ClimaticSummaryOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        elementColumn: this.elementColumn(),
        stationColumn: this.stationColumn() || undefined,
        level: this.summaryLevel(),
        summaryFunction: this.summaryFunction(),
        omitMissing: this.omitMissing(),
      };
      return rSyntax().setBase(buildClimaticSummary(opts));
    });

    // Reactive updates
    this.createEffect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.elementColumn();
      this.stationColumn();
      this.summaryLevel();
      this.summaryFunction();
      this.omitMissing();
      this.rebuildRCode();
    });
  }

  reset(): void {
    this.dateColumn.set('');
    this.elementColumn.set('');
    this.stationColumn.set('');
    this.summaryLevel.set(DEFAULT_SUMMARY_OPTIONS.level!);
    this.summaryFunction.set(DEFAULT_SUMMARY_OPTIONS.summaryFunction!);
    this.omitMissing.set(DEFAULT_SUMMARY_OPTIONS.omitMissing!);
  }

  isValid(): boolean {
    return !!(
      this.selectedDataframe() &&
      this.dateColumn() &&
      this.elementColumn()
    );
  }
}
