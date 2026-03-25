import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ColumnSelectorComponent, ColumnSlotComponent } from '../../../shared/components/column-selector';
import { DialogBase } from '../dialog-base';
import { AIDialogClassRegistry } from '../../../core/ai/dialog-class-registry';
import { rSyntax } from '../../../core/r-codegen';

@Component({
  selector: 'app-dot-plot-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, ColumnSelectorComponent, ColumnSlotComponent],
  template: `
    <div class="dialog-content dot-plot-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'DOT_PLOT.TITLE' | translate }}</h2>
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

        <app-column-selector [columns]="columns()">
          <app-column-slot name="xVariable" [label]="'DOT_PLOT.X_VARIABLE' | translate"
            filter="factor" [required]="true"
            [(column)]="xVariable" />
          <app-column-slot name="yVariable" [label]="'DOT_PLOT.Y_VARIABLE' | translate"
            filter="numeric" [required]="true"
            [(column)]="yVariable" />
          <app-column-slot name="fillBy" [label]="'DOT_PLOT.FILL_BY' | translate"
            filter="factor"
            [(column)]="fillBy" />
        </app-column-selector>

        <!-- Dot Size -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'DOT_PLOT.DOT_SIZE' | translate }}: {{ dotSize() }}</label>
          <input
            type="range"
            class="range range-primary range-sm"
            min="0.1"
            max="2"
            step="0.1"
            [ngModel]="dotSize()"
            (ngModelChange)="dotSize.set(+$event)"
          />
        </div>

        <!-- Stack Direction -->
        <div class="form-group mt-4">
          <label class="form-label">{{ 'DOT_PLOT.STACK_DIRECTION' | translate }}</label>
          <div class="flex gap-4">
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                name="stackdir"
                class="radio radio-sm"
                value="center"
                [checked]="stackDirection() === 'center'"
                (change)="stackDirection.set('center')"
              />
              <span class="text-sm">{{ 'DOT_PLOT.CENTER' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                name="stackdir"
                class="radio radio-sm"
                value="up"
                [checked]="stackDirection() === 'up'"
                (change)="stackDirection.set('up')"
              />
              <span class="text-sm">{{ 'DOT_PLOT.UP' | translate }}</span>
            </label>
            <label class="cursor-pointer flex items-center gap-2">
              <input
                type="radio"
                name="stackdir"
                class="radio radio-sm"
                value="down"
                [checked]="stackDirection() === 'down'"
                (change)="stackDirection.set('down')"
              />
              <span class="text-sm">{{ 'DOT_PLOT.DOWN' | translate }}</span>
            </label>
          </div>
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
    .dot-plot-dialog { width: 500px; max-width: 90vw; }
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
export class DotPlotDialogComponent extends DialogBase implements OnInit {
  static { AIDialogClassRegistry.register(DotPlotDialogComponent); }
  static readonly dialogId = 'dot-plot';

  xVariable = signal('');
  yVariable = signal('');
  fillBy = signal('');
  dotSize = signal(0.5);
  stackDirection = signal<'center' | 'up' | 'down'>('center');

  override ngOnInit(): void {
    super.ngOnInit();

    this.registerFormFields({
      xVariable: this.xVariable,
      yVariable: this.yVariable,
      fillBy: this.fillBy,
      dotSize: this.dotSize,
      stackDirection: this.stackDirection,
    });

    this.initializeCodeManager(() => rSyntax().setBase(this.buildDotPlotCode()));

    this.createEffect(() => {
      this.selectedDataframe();
      this.xVariable();
      this.yVariable();
      this.fillBy();
      this.dotSize();
      this.stackDirection();
      this.rebuildRCode();
    });
  }

  override async onDataframeChange(name: string): Promise<void> {
    await super.onDataframeChange(name);
    this.xVariable.set('');
    this.yVariable.set('');
    this.fillBy.set('');
  }

  isValid(): boolean {
    return !!(this.selectedDataframe() && this.xVariable() && this.yVariable());
  }

  private buildDotPlotCode(): string {
    if (!this.selectedDataframe() || !this.xVariable() || !this.yVariable()) {
      return '# Select dataframe, X and Y variables';
    }

    let aesStr = `aes(x = ${this.xVariable()}, y = ${this.yVariable()}`;
    if (this.fillBy()) {
      aesStr += `, fill = ${this.fillBy()}`;
    }
    aesStr += ')';

    let code = `ggplot(get_dataframe("${this.selectedDataframe()}"), ${aesStr}) +\n`;
    code += '  geom_dotplot(\n';
    code += '    binaxis = "y",\n';
    code += `    stackdir = "${this.stackDirection()}",\n`;
    code += `    dotsize = ${this.dotSize()}\n`;
    code += '  ) +\n';
    code += '  theme_minimal() +\n';
    code += `  labs(x = "${this.xVariable()}", y = "${this.yVariable()}")`;
    return code;
  }
}
