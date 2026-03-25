/**
 * Spell Lengths Dialog Component
 * 
 * Dialog for wet/dry spell analysis using run-length encoding.
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
import { buildSpellLengths, SpellLengthsOptions } from '../utils/climatic-r-builders';
import { rSyntax } from '../../../../core/r-codegen';
import { mapClimaticRolesToFields } from '../utils/climatic-role-mapper';

@Component({
  selector: 'app-spell-lengths-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnSelectorComponent, ColumnSlotComponent, CodePreviewComponent],
  template: `
    <div class="dialog-content climatic-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'CLIMATIC.SPELL_LENGTHS' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <div class="form-group">
          <label class="form-label">{{ 'DIALOG.DATA_FRAME' | translate }}</label>
          @if (dataframes().length === 0) {
            <div class="text-sm text-base-content/60 bg-base-200 rounded-lg p-3">{{ 'DIALOG.NO_DATA' | translate }}</div>
          } @else {
            <select class="select select-bordered w-full select-sm" [ngModel]="selectedDataframe()" (ngModelChange)="onDataframeChange($event)">
              @for (df of dataframes(); track df) { <option [value]="df">{{ df }}</option> }
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

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-4">
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.SPELL_TYPE' | translate }}</label>
            <select class="select select-bordered w-full select-sm" [ngModel]="spellType()" (ngModelChange)="spellType.set($event)">
              <option value="wet">{{ 'CLIMATIC.WET_SPELL' | translate }}</option>
              <option value="dry">{{ 'CLIMATIC.DRY_SPELL' | translate }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.THRESHOLD' | translate }}</label>
            <input type="number" class="input input-bordered w-full input-sm" [ngModel]="threshold()" (ngModelChange)="threshold.set(+$event)" step="0.1" />
          </div>
          <div class="form-group">
            <label class="form-label">{{ 'CLIMATIC.STATISTIC' | translate }}</label>
            <select class="select select-bordered w-full select-sm" [ngModel]="statistic()" (ngModelChange)="statistic.set($event)">
              <option value="max">{{ 'CLIMATIC.MAXIMUM' | translate }}</option>
              <option value="mean">{{ 'CLIMATIC.MEAN' | translate }}</option>
              <option value="count">{{ 'CLIMATIC.COUNT' | translate }}</option>
            </select>
          </div>
        </div>

        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ (showCodePreview() ? 'DIALOG.HIDE_CODE' : 'DIALOG.SHOW_CODE') | translate }}
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button class="btn btn-primary" (click)="execute()" [disabled]="!isValid() || isLoading()">
          @if (isLoading()) { <span class="loading loading-spinner loading-sm"></span> }
          {{ 'DIALOG.OK' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .climatic-dialog { max-width: 90vw; }
  `]
})
export class SpellLengthsDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(SpellLengthsDialogComponent); }

  private readonly climaticService = inject(ClimaticDataService);

  // Form state (signals for reactivity)
  dateColumn = signal('');
  elementColumn = signal('');
  stationColumn = signal('');
  spellType = signal<'wet' | 'dry'>('wet');
  threshold = signal(1);
  statistic = signal<'max' | 'mean' | 'count'>('max');

  override ngOnInit(): void {
    super.ngOnInit();

    // Register form fields for automatic save/restore/auto-population
    this.registerFormFields({
      dateColumn: this.dateColumn,
      elementColumn: this.elementColumn,
      stationColumn: this.stationColumn,
      spellType: this.spellType,
      threshold: this.threshold,
      statistic: this.statistic,
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

      const opts: SpellLengthsOptions = {
        dataframe: df,
        dateColumn: this.dateColumn(),
        elementColumn: this.elementColumn(),
        stationColumn: this.stationColumn() || undefined,
        spellType: this.spellType(),
        threshold: this.threshold(),
        statistic: this.statistic(),
      };
      return rSyntax().setBase(buildSpellLengths(opts));
    });

    // Reactive updates
    this.createEffect(() => {
      this.selectedDataframe();
      this.dateColumn();
      this.elementColumn();
      this.stationColumn();
      this.spellType();
      this.threshold();
      this.statistic();
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    return !!(this.selectedDataframe() && this.dateColumn() && this.elementColumn());
  }
}
