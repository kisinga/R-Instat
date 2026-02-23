import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { DialogBase } from '../dialog-base';
import { rSyntax } from '../../../core/r-codegen';

@Component({
  selector: 'app-line-plot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content line-plot-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'LINE_PLOT.TITLE' | translate }}</h2>
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
          <!-- X Variable -->
          <div class="form-group">
            <label class="form-label">{{ 'LINE_PLOT.X_VARIABLE' | translate }}</label>
            <app-column-picker
              [columns]="columns()"
              [multiple]="false"
              [selectedColumn]="xVariable()"
              (selectedColumnChange)="xVariable.set($event)"
            />
          </div>

          <!-- Y Variable -->
          <div class="form-group">
            <label class="form-label">{{ 'LINE_PLOT.Y_VARIABLE' | translate }}</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="false"
              [selectedColumn]="yVariable()"
              (selectedColumnChange)="yVariable.set($event)"
            />
          </div>
        </div>

        <!-- Group/Color By -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'LINE_PLOT.GROUP_BY' | translate }} <span class="text-xs opacity-60">({{ 'DIALOG.OPTIONAL' | translate }})</span></label>
          <select class="select select-bordered w-full select-sm" [ngModel]="groupBy()" (ngModelChange)="groupBy.set($event)">
            <option value="">{{ 'DIALOG.NONE' | translate }}</option>
            @for (col of getFactorColumns(); track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
        </div>

        <!-- Options -->
        <div class="flex gap-4 mt-4">
          <label class="cursor-pointer flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" [ngModel]="showPoints()" (ngModelChange)="showPoints.set($event)" />
            <span class="text-sm">{{ 'LINE_PLOT.SHOW_POINTS' | translate }}</span>
          </label>
          <label class="cursor-pointer flex items-center gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" [ngModel]="smoothLine()" (ngModelChange)="smoothLine.set($event)" />
            <span class="text-sm">{{ 'LINE_PLOT.SMOOTH_LINE' | translate }}</span>
          </label>
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
    .line-plot-dialog { width: 500px; max-width: 90vw; }
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
export class LinePlotDialogComponent extends DialogBase implements OnInit {
  static readonly dialogId = 'line-plot';
  readonly dialogTitle = 'Line Plot';

  xVariable = signal('');
  yVariable = signal('');
  groupBy = signal('');
  showPoints = signal(true);
  smoothLine = signal(false);

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      xVariable: this.xVariable,
      yVariable: this.yVariable,
      groupBy: this.groupBy,
      showPoints: this.showPoints,
      smoothLine: this.smoothLine,
    });

    this.initializeCodeManager(() => rSyntax().setBase(this.buildLinePlotCode()));

    this.createEffect(() => {
      this.selectedDataframe();
      this.xVariable();
      this.yVariable();
      this.groupBy();
      this.showPoints();
      this.smoothLine();
      this.rebuildRCode();
    });
  }

  override async onDataframeChange(name: string): Promise<void> {
    await super.onDataframeChange(name);
    this.xVariable.set('');
    this.yVariable.set('');
    this.groupBy.set('');
  }

  isValid(): boolean {
    return !!(this.selectedDataframe() && this.xVariable() && this.yVariable());
  }

  private buildLinePlotCode(): string {
    if (!this.selectedDataframe() || !this.xVariable() || !this.yVariable()) {
      return '# Select dataframe, X and Y variables';
    }

    let aesStr = `aes(x = ${this.xVariable()}, y = ${this.yVariable()}`;
    if (this.groupBy()) {
      aesStr += `, color = ${this.groupBy()}, group = ${this.groupBy()}`;
    }
    aesStr += ')';

    let code = `ggplot(get_dataframe("${this.selectedDataframe()}"), ${aesStr}) +\n`;
    code += this.smoothLine() ? '  geom_smooth(se = FALSE) +\n' : '  geom_line() +\n';
    if (this.showPoints()) {
      code += '  geom_point() +\n';
    }
    code += '  theme_minimal() +\n';
    code += `  labs(x = "${this.xVariable()}", y = "${this.yVariable()}")`;
    return code;
  }
}
