import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';

@Component({
  selector: 'app-t-test-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent],
  template: `
    <div class="dialog-content" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ dialogTitle }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="cancel()">✕</button>
      </div>

      <div class="dialog-body">
        <!-- Dataframe Selection -->
        <div class="form-group">
          <label class="form-label">Data Frame</label>
          <select 
            class="select select-bordered w-full"
            [ngModel]="selectedDataframe()"
            (ngModelChange)="onDataframeChange($event)"
          >
            @for (df of dataframes(); track df) {
              <option [value]="df">{{ df }}</option>
            }
          </select>
        </div>

        <!-- Test Type -->
        <div class="form-group">
          <label class="form-label">Test Type</label>
          <select class="select select-bordered w-full" [(ngModel)]="testType">
            <option value="one">One Sample t-test</option>
            <option value="two">Two Sample t-test</option>
            <option value="paired">Paired t-test</option>
          </select>
        </div>

        <!-- Variable Selection -->
        <div class="form-group">
          <label class="form-label">{{ testType === 'two' ? 'Response Variable' : 'Variable' }} (numeric)</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [(selectedColumn)]="variable1"
          />
        </div>

        @if (testType === 'one') {
          <div class="form-group">
            <label class="form-label">Test Value (μ₀)</label>
            <input
              type="number"
              class="input input-bordered w-full"
              [(ngModel)]="mu"
            />
          </div>
        }

        @if (testType === 'two') {
          <div class="form-group">
            <label class="form-label">Grouping Variable (factor)</label>
            <app-column-picker
              [columns]="getFactorColumns()"
              [multiple]="false"
              [(selectedColumn)]="groupVar"
            />
          </div>
        }

        @if (testType === 'paired') {
          <div class="form-group">
            <label class="form-label">Second Variable (numeric)</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="false"
              [(selectedColumn)]="variable2"
            />
          </div>
        }

        <!-- Alternative Hypothesis -->
        <div class="form-group">
          <label class="form-label">Alternative Hypothesis</label>
          <select class="select select-bordered w-full" [(ngModel)]="alternative">
            <option value="two.sided">Two-sided (≠)</option>
            <option value="less">Less than (<)</option>
            <option value="greater">Greater than (>)</option>
          </select>
        </div>

        <!-- Confidence Level -->
        <div class="form-group">
          <label class="form-label">Confidence Level</label>
          <select class="select select-bordered w-full" [(ngModel)]="confLevel">
            <option value="0.90">90%</option>
            <option value="0.95">95%</option>
            <option value="0.99">99%</option>
          </select>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <label class="form-label">R Code Preview</label>
            <pre class="code-block">{{ buildRCode() }}</pre>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn btn-ghost btn-sm" (click)="toggleCodePreview()">
          {{ showCodePreview() ? 'Hide' : 'Show' }} Code
        </button>
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="cancel()">Cancel</button>
        <button 
          class="btn btn-primary" 
          (click)="execute()"
          [disabled]="!isValid() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          OK
        </button>
      </div>
    </div>
  `,
})
export class TTestDialogComponent extends DialogBase {
  readonly dialogTitle = 't-Test';

  testType = 'one';
  variable1 = '';
  variable2 = '';
  groupVar = '';
  mu = 0;
  alternative = 'two.sided';
  confLevel = '0.95';

  buildRCode(): string {
    const df = this.selectedDataframe();
    if (!df) return '# Select a dataframe first';
    if (!this.variable1) return '# Select the test variable';

    switch (this.testType) {
      case 'one':
        return `# One Sample t-test
t.test(
  get_dataframe("${df}")$${this.variable1},
  mu = ${this.mu},
  alternative = "${this.alternative}",
  conf.level = ${this.confLevel}
)`;

      case 'two':
        return `# Two Sample t-test
t.test(
  ${this.variable1} ~ ${this.groupVar},
  data = get_dataframe("${df}"),
  alternative = "${this.alternative}",
  conf.level = ${this.confLevel}
)`;

      case 'paired':
        return `# Paired t-test
t.test(
  get_dataframe("${df}")$${this.variable1},
  get_dataframe("${df}")$${this.variable2},
  paired = TRUE,
  alternative = "${this.alternative}",
  conf.level = ${this.confLevel}
)`;

      default:
        return '# Unknown test type';
    }
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.variable1) {
      return false;
    }

    switch (this.testType) {
      case 'one':
        return true;
      case 'two':
        return !!this.groupVar;
      case 'paired':
        return !!this.variable2;
      default:
        return false;
    }
  }
}
