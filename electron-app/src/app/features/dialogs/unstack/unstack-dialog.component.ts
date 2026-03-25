import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { DialogBase } from '../dialog-base';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';
import { rSyntax } from '../../../core/r-codegen';

@Component({
  selector: 'app-unstack-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content unstack-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'UNSTACK.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
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

        <div class="grid grid-cols-2 gap-4 mt-4">
          <!-- Names From -->
          <div class="form-group">
            <label class="form-label">{{ 'UNSTACK.NAMES_FROM' | translate }}</label>
            <app-column-picker
              [columns]="getFactorColumns()"
              [multiple]="false"
              [selectedColumn]="namesFrom()"
              (selectedColumnChange)="namesFrom.set($event)"
            />
            <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.NAMES_HINT' | translate }}</p>
          </div>

          <!-- Values From -->
          <div class="form-group">
            <label class="form-label">{{ 'UNSTACK.VALUES_FROM' | translate }}</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="false"
              [selectedColumn]="valuesFrom()"
              (selectedColumnChange)="valuesFrom.set($event)"
            />
            <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.VALUES_HINT' | translate }}</p>
          </div>
        </div>

        <!-- Values Fill -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'UNSTACK.VALUES_FILL' | translate }}</label>
          <input
            type="text"
            class="input input-bordered w-full input-sm"
            [ngModel]="valuesFill()"
            (ngModelChange)="valuesFill.set($event)"
            placeholder="NA"
          />
          <p class="text-xs text-base-content/60 mt-1">{{ 'UNSTACK.FILL_HINT' | translate }}</p>
        </div>

        <!-- Result Name -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'UNSTACK.RESULT_NAME' | translate }}</label>
          <input
            type="text"
            class="input input-bordered w-full input-sm"
            [ngModel]="resultName()"
            (ngModelChange)="resultName.set($event)"
            placeholder="unstacked_data"
          />
        </div>

        <!-- Code Preview -->
        <div class="code-preview-section mt-4">
          <button class="btn btn-ghost btn-xs gap-1" (click)="toggleCodePreview()">
            {{ showCodePreview() ? ('DIALOG.HIDE_CODE' | translate) : ('DIALOG.SHOW_CODE' | translate) }}
          </button>
          @if (showCodePreview()) {
            <pre class="code-block mt-2">{{ rCode() }}</pre>
          }
        </div>
      </div>

      <div class="dialog-footer">
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
    .unstack-dialog { width: 550px; max-width: 90vw; }
    .code-block { 
      background: hsl(var(--b2)); 
      border-radius: 0.5rem; 
      padding: 0.75rem; 
      font-family: monospace; 
      font-size: 0.7rem; 
      overflow-x: auto; 
      max-height: 150px; 
      white-space: pre-wrap; 
    }
    .code-preview-section { border-top: 1px solid hsl(var(--b3)); padding-top: 0.75rem; }
  `]
})
export class UnstackDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(UnstackDialogComponent); }
  static readonly dialogId = 'unstack';

  namesFrom = signal('');
  valuesFrom = signal('');
  valuesFill = signal('');
  resultName = signal('unstacked_data');

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      namesFrom: this.namesFrom,
      valuesFrom: this.valuesFrom,
      valuesFill: this.valuesFill,
      resultName: this.resultName,
    });

    this.initializeCodeManager(() => rSyntax().setBase(this.buildUnstackCode()));

    this.createEffect(() => {
      this.selectedDataframe();
      this.namesFrom();
      this.valuesFrom();
      this.valuesFill();
      this.resultName();
      this.rebuildRCode();
    });
  }

  override async onDataframeChange(name: string): Promise<void> {
    await super.onDataframeChange(name);
    this.namesFrom.set('');
    this.valuesFrom.set('');
  }

  isValid(): boolean {
    return !!(
      this.selectedDataframe() &&
      this.namesFrom() &&
      this.valuesFrom() &&
      this.resultName().trim()
    );
  }

  private buildUnstackCode(): string {
    if (!this.selectedDataframe() || !this.namesFrom() || !this.valuesFrom()) {
      return '# Select dataframe and columns';
    }

    const outputName = this.resultName().trim() || 'unstacked_data';
    let code = `${outputName} <- get_dataframe("${this.selectedDataframe()}") %>%\n`;
    code += '  tidyr::pivot_wider(\n';
    code += `    names_from = ${this.namesFrom()},\n`;
    code += `    values_from = ${this.valuesFrom()}`;

    if (this.valuesFill() && this.valuesFill() !== 'NA') {
      const fillValue = Number.isNaN(Number(this.valuesFill()))
        ? `"${this.valuesFill()}"`
        : this.valuesFill();
      code += `,\n    values_fill = ${fillValue}`;
    }

    code += '\n  )\n';
    code += `add_dataframe(name = "${outputName}", df = ${outputName})`;
    return code;
  }
}
