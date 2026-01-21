import { Component, OnInit, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogBase } from '../dialog-base';
import { ColumnPickerComponent } from '../../../shared/components/column-picker/column-picker.component';
import { CodePreviewComponent } from '../../../shared/components/code-preview/code-preview.component';
import { buildTTest, TTestOptions } from '../../../core/dialogs/builders/statistics';

@Component({
  selector: 'app-t-test-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ColumnPickerComponent, CodePreviewComponent],
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
          <select 
            class="select select-bordered w-full" 
            [ngModel]="testType()"
            (ngModelChange)="testType.set($event)"
          >
            <option value="one">One Sample t-test</option>
            <option value="two">Two Sample t-test</option>
            <option value="paired">Paired t-test</option>
          </select>
        </div>

        <!-- Variable Selection -->
        <div class="form-group">
          <label class="form-label">{{ testType() === 'two' ? 'Response Variable' : 'Variable' }} (numeric)</label>
          <app-column-picker
            [columns]="getNumericColumns()"
            [multiple]="false"
            [selectedColumn]="variable1()"
            (selectedColumnChange)="variable1.set($event)"
          />
        </div>

        @if (testType() === 'one') {
          <div class="form-group">
            <label class="form-label">Test Value (μ₀)</label>
            <input
              type="number"
              class="input input-bordered w-full"
              [ngModel]="mu()"
              (ngModelChange)="mu.set($event)"
            />
          </div>
        }

        @if (testType() === 'two') {
          <div class="form-group">
            <label class="form-label">Grouping Variable (factor)</label>
            <app-column-picker
              [columns]="getFactorColumns()"
              [multiple]="false"
              [selectedColumn]="groupVar()"
            (selectedColumnChange)="groupVar.set($event)"
            />
          </div>
        }

        @if (testType() === 'paired') {
          <div class="form-group">
            <label class="form-label">Second Variable (numeric)</label>
            <app-column-picker
              [columns]="getNumericColumns()"
              [multiple]="false"
              [selectedColumn]="variable2()"
            (selectedColumnChange)="variable2.set($event)"
            />
          </div>
        }

        <!-- Alternative Hypothesis -->
        <div class="form-group">
          <label class="form-label">Alternative Hypothesis</label>
          <select 
            class="select select-bordered w-full" 
            [ngModel]="alternative()"
            (ngModelChange)="alternative.set($event)"
          >
            <option value="two.sided">Two-sided (≠)</option>
            <option value="less">Less than (<)</option>
            <option value="greater">Greater than (>)</option>
          </select>
        </div>

        <!-- Confidence Level -->
        <div class="form-group">
          <label class="form-label">Confidence Level</label>
          <select 
            class="select select-bordered w-full" 
            [ngModel]="confLevel()"
            (ngModelChange)="confLevel.set($event)"
          >
            <option value="0.90">90%</option>
            <option value="0.95">95%</option>
            <option value="0.99">99%</option>
          </select>
        </div>

        <!-- Code Preview -->
        @if (showCodePreview()) {
          <div class="form-group mt-4">
            <app-code-preview [code]="rCode()" [collapsible]="false" [isValid]="formValid()" />
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
export class TTestDialogComponent extends DialogBase implements OnInit {
  readonly dialogTitle = 't-Test';

  testType = signal<'one' | 'two' | 'paired'>('one');
  variable1 = signal('');
  variable2 = signal('');
  groupVar = signal('');
  mu = signal<string>('0');
  alternative = signal<'two.sided' | 'less' | 'greater'>('two.sided');
  confLevel = signal('0.95');

  override ngOnInit(): void {
    super.ngOnInit();

    this.initializeCodeManager(() => {
      const df = this.selectedDataframe();
      if (!df) {
        return buildTTest({
          testType: 'one',
          dataframe: '',
          variable1: '',
          mu: '0',
        });
      }

      if (!this.variable1()) {
        return buildTTest({
          testType: 'one',
          dataframe: df,
          variable1: '',
          mu: '0',
        });
      }

      const baseOptions = {
        dataframe: df,
        alternative: this.alternative(),
        confLevel: this.confLevel(),
      };

      const testType = this.testType();
      let options: TTestOptions;

      switch (testType) {
        case 'one':
          options = {
            ...baseOptions,
            testType: 'one',
            variable1: this.variable1(),
            mu: this.mu(),
          };
          break;

        case 'two':
          options = {
            ...baseOptions,
            testType: 'two',
            variable1: this.variable1(),
            groupVar: this.groupVar(),
          };
          break;

        case 'paired':
          options = {
            ...baseOptions,
            testType: 'paired',
            variable1: this.variable1(),
            variable2: this.variable2(),
          };
          break;
      }

      return buildTTest(options);
    });

    // Set up effect to rebuild R code whenever dialog state changes
    this.createEffect(() => {
      // Read all signals to establish dependencies
      this.selectedDataframe();
      this.testType();
      this.variable1();
      this.variable2();
      this.groupVar();
      this.mu();
      this.alternative();
      this.confLevel();

      // Rebuild when any dependency changes
      this.rebuildRCode();
    });
  }

  isValid(): boolean {
    if (!this.selectedDataframe() || !this.variable1()) {
      return false;
    }

    const testType = this.testType();
    switch (testType) {
      case 'one':
        return true;
      case 'two':
        return !!this.groupVar();
      case 'paired':
        return !!this.variable2();
      default:
        return false;
    }
  }
}
