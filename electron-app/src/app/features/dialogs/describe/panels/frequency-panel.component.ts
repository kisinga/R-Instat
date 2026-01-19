/**
 * Frequency Panel Component
 * 
 * Panel for configuring frequency table output.
 * Supports one-way and two-way frequency tables with various display options.
 */

import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColumnInfo } from '../../../../core/models/r.model';
import { DescribeDialogService } from '../describe-dialog.service';

@Component({
  selector: 'app-frequency-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="frequency-panel">
      <!-- Table Type Indicator -->
      <div class="info-badge mb-3">
        @if (tableType() === 'one-way') {
          <span class="badge badge-info badge-sm">One-Way Frequency Table</span>
        } @else if (tableType() === 'two-way') {
          <span class="badge badge-warning badge-sm">Two-Way Frequency Table</span>
        } @else {
          <span class="badge badge-ghost badge-sm">Select categorical variables</span>
        }
      </div>

      <!-- Display Options -->
      <div class="form-group">
        <label class="form-label">Display Options</label>
        <div class="options-grid">
          <!-- Count -->
          <label class="label cursor-pointer justify-start gap-2 bg-base-200 rounded-lg px-3 py-2">
            <input 
              type="checkbox" 
              class="checkbox checkbox-sm checkbox-primary"
              [checked]="service.showCount()"
              (change)="service.setShowCount($any($event.target).checked)"
            />
            <div class="flex flex-col">
              <span class="text-sm">Count</span>
              <span class="text-xs text-base-content/50">Show raw frequencies</span>
            </div>
          </label>

          <!-- Row Percentage (for two-way) -->
          @if (tableType() === 'two-way') {
            <label class="label cursor-pointer justify-start gap-2 bg-base-200 rounded-lg px-3 py-2">
              <input 
                type="checkbox" 
                class="checkbox checkbox-sm checkbox-primary"
                [checked]="service.showRowPercent()"
                (change)="service.setShowRowPercent($any($event.target).checked)"
              />
              <div class="flex flex-col">
                <span class="text-sm">Row %</span>
                <span class="text-xs text-base-content/50">Percentage within row</span>
              </div>
            </label>

            <!-- Column Percentage -->
            <label class="label cursor-pointer justify-start gap-2 bg-base-200 rounded-lg px-3 py-2">
              <input 
                type="checkbox" 
                class="checkbox checkbox-sm checkbox-primary"
                [checked]="service.showColPercent()"
                (change)="service.setShowColPercent($any($event.target).checked)"
              />
              <div class="flex flex-col">
                <span class="text-sm">Column %</span>
                <span class="text-xs text-base-content/50">Percentage within column</span>
              </div>
            </label>
          }
        </div>
      </div>

      <!-- Weights (optional) -->
      @if (numericColumns.length > 0) {
        <div class="form-group">
          <label class="form-label">Weights (optional)</label>
          <select 
            class="select select-bordered select-sm w-full"
            [ngModel]="service.weights()"
            (ngModelChange)="service.setWeights($event)"
          >
            <option value="">No weights</option>
            @for (col of numericColumns; track col.name) {
              <option [value]="col.name">{{ col.name }}</option>
            }
          </select>
          <span class="text-xs text-base-content/50">Use a numeric variable for weighted frequencies</span>
        </div>
      }

      <!-- Output Info -->
      <div class="info-box mt-3">
        @if (tableType() === 'one-way') {
          <p class="text-sm text-base-content/70">
            Produces a frequency table with counts and percentages for each category.
            Uses <code>dplyr::count()</code>.
          </p>
        } @else if (tableType() === 'two-way') {
          <p class="text-sm text-base-content/70">
            Produces a cross-tabulation of two categorical variables.
            Uses <code>janitor::tabyl()</code> for clean output.
          </p>
        } @else {
          <p class="text-sm text-base-content/70">
            Select one or two categorical variables to create a frequency table.
          </p>
        }
      </div>
    </div>
  `,
  styles: [`
    .frequency-panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .form-label {
      font-size: 0.875rem;
      font-weight: 500;
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .info-box {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 0.75rem;
    }

    code {
      background: hsl(var(--b3));
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      font-size: 0.8em;
    }

    .info-badge {
      display: flex;
      align-items: center;
    }
  `],
})
export class FrequencyPanelComponent {
  @Input() columns: ColumnInfo[] = [];
  @Input() numericColumns: ColumnInfo[] = [];

  readonly service = inject(DescribeDialogService);

  readonly tableType = computed(() => {
    const analysis = this.service.analysis();
    const catCount = analysis.categoricalCount;
    
    if (catCount === 0) return 'none';
    if (catCount === 1) return 'one-way';
    return 'two-way';
  });
}
