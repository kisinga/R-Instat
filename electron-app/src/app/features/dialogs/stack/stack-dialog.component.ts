import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { DialogBase } from '../dialog-base';
import { rSyntax } from '../../../core/r-codegen';

@Component({
  selector: 'app-stack-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content stack-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'STACK.TITLE' | translate }}</h2>
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

        <!-- Columns to Stack -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'STACK.COLUMNS_TO_STACK' | translate }}</label>
          <p class="text-xs text-base-content/60 mb-2">{{ 'STACK.COLUMNS_HINT' | translate }}</p>
          <div class="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-base-200 rounded-lg">
            @for (col of columns(); track col.name) {
              <label class="cursor-pointer flex items-center gap-1.5 bg-base-100 px-2 py-1 rounded shadow-sm">
                <input type="checkbox" class="checkbox checkbox-xs" 
                  [checked]="columnsToStack().includes(col.name)"
                  (change)="toggleColumn(col.name)" />
                <span class="text-sm">{{ col.name }}</span>
              </label>
            }
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-4">
          <!-- Names To -->
          <div class="form-group">
            <label class="form-label">{{ 'STACK.NAMES_TO' | translate }}</label>
            <input
              type="text"
              class="input input-bordered w-full input-sm"
              [ngModel]="namesTo()"
              (ngModelChange)="namesTo.set($event)"
              placeholder="variable"
            />
            <p class="text-xs text-base-content/60 mt-1">{{ 'STACK.NAMES_HINT' | translate }}</p>
          </div>

          <!-- Values To -->
          <div class="form-group">
            <label class="form-label">{{ 'STACK.VALUES_TO' | translate }}</label>
            <input
              type="text"
              class="input input-bordered w-full input-sm"
              [ngModel]="valuesTo()"
              (ngModelChange)="valuesTo.set($event)"
              placeholder="value"
            />
            <p class="text-xs text-base-content/60 mt-1">{{ 'STACK.VALUES_HINT' | translate }}</p>
          </div>
        </div>

        <!-- Options -->
        <div class="form-group mt-4">
          <label class="cursor-pointer flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" [ngModel]="dropNA()" (ngModelChange)="dropNA.set($event)" />
            <span class="text-sm">{{ 'STACK.DROP_NA' | translate }}</span>
          </label>
        </div>

        <!-- Result Name -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'STACK.RESULT_NAME' | translate }}</label>
          <input
            type="text"
            class="input input-bordered w-full input-sm"
            [ngModel]="resultName()"
            (ngModelChange)="resultName.set($event)"
            placeholder="stacked_data"
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
    .stack-dialog { width: 550px; max-width: 90vw; }
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
export class StackDialogComponent extends DialogBase implements OnInit {
  static readonly dialogId = 'stack';
  readonly dialogTitle = 'Stack';

  columnsToStack = signal<string[]>([]);
  namesTo = signal('variable');
  valuesTo = signal('value');
  dropNA = signal(true);
  resultName = signal('stacked_data');

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      columnsToStack: this.columnsToStack,
      namesTo: this.namesTo,
      valuesTo: this.valuesTo,
      dropNA: this.dropNA,
      resultName: this.resultName,
    });

    this.initializeCodeManager(() => rSyntax().setBase(this.buildStackCode()));

    this.createEffect(() => {
      this.selectedDataframe();
      this.columnsToStack();
      this.namesTo();
      this.valuesTo();
      this.dropNA();
      this.resultName();
      this.rebuildRCode();
    });
  }

  override async onDataframeChange(name: string): Promise<void> {
    await super.onDataframeChange(name);
    this.columnsToStack.set([]);
  }

  toggleColumn(colName: string): void {
    this.columnsToStack.update((current) =>
      current.includes(colName) ? current.filter((c) => c !== colName) : [...current, colName]
    );
  }

  isValid(): boolean {
    return !!(
      this.selectedDataframe() &&
      this.columnsToStack().length > 0 &&
      this.namesTo().trim() &&
      this.valuesTo().trim() &&
      this.resultName().trim()
    );
  }

  private buildStackCode(): string {
    if (!this.selectedDataframe() || this.columnsToStack().length === 0) {
      return '# Select dataframe and columns to stack';
    }

    const outputName = this.resultName().trim() || 'stacked_data';
    const cols = this.columnsToStack().map((c) => `"${c}"`).join(', ');

    let code = `${outputName} <- get_dataframe("${this.selectedDataframe()}") %>%\n`;
    code += '  tidyr::pivot_longer(\n';
    code += `    cols = c(${cols}),\n`;
    code += `    names_to = "${this.namesTo().trim() || 'variable'}",\n`;
    code += `    values_to = "${this.valuesTo().trim() || 'value'}"`;
    if (this.dropNA()) {
      code += ',\n    values_drop_na = TRUE';
    }
    code += '\n  )\n';
    code += `add_dataframe(name = "${outputName}", df = ${outputName})`;
    return code;
  }
}
