/**
 * Graph Panel Component
 * 
 * Panel for configuring graph output.
 * Dynamically shows available graph types based on selected variable types.
 */

import { Component, Input, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColumnInfo } from '../../../../core/models/r.model';
import { DescribeDialogService } from '../describe-dialog.service';
import { GraphType, GRAPH_CONFIGS } from '../utils/variable-type-analyzer';

@Component({
  selector: 'app-graph-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="graph-panel">
      <!-- Graph Type Selection -->
      <div class="form-group">
        <label class="form-label">Graph Type</label>
        @if (service.availableGraphs().length > 0) {
          <div class="graph-type-grid">
            @for (graph of service.availableGraphs(); track graph.type) {
              <label 
                class="graph-type-card"
                [class.selected]="service.graphType() === graph.type"
              >
                <input 
                  type="radio" 
                  class="radio radio-sm radio-primary"
                  [value]="graph.type"
                  [checked]="service.graphType() === graph.type"
                  (change)="service.setGraphType(graph.type)"
                />
                <div class="graph-type-info">
                  <span class="graph-type-icon">{{ getGraphIcon(graph.type) }}</span>
                  <span class="graph-type-label">{{ graph.label }}</span>
                </div>
              </label>
            }
          </div>
        } @else {
          <div class="empty-state">
            <p class="text-sm text-base-content/60">
              Select variables to see available graph types
            </p>
          </div>
        }
      </div>

      <!-- Graph Options (shown when a graph type is selected) -->
      @if (service.graphType()) {
        <div class="graph-options">
          <!-- Common Options -->
          <div class="form-group">
            <label class="form-label">Options</label>
            <div class="options-grid">
              <!-- Flip Coordinates -->
              @if (supportsFlip()) {
                <label class="label cursor-pointer justify-start gap-2">
                  <input 
                    type="checkbox" 
                    class="checkbox checkbox-sm"
                    [checked]="service.graphOptions().flipCoords"
                    (change)="updateOption('flipCoords', $any($event.target).checked)"
                  />
                  <span class="text-sm">Flip coordinates</span>
                </label>
              }

              <!-- Show Labels -->
              @if (supportsLabels()) {
                <label class="label cursor-pointer justify-start gap-2">
                  <input 
                    type="checkbox" 
                    class="checkbox checkbox-sm"
                    [checked]="service.graphOptions().showLabels"
                    (change)="updateOption('showLabels', $any($event.target).checked)"
                  />
                  <span class="text-sm">Show labels</span>
                </label>
              }
            </div>
          </div>

          <!-- Bins (for histogram) -->
          @if (service.graphType() === 'histogram') {
            <div class="form-group">
              <label class="form-label">Number of Bins</label>
              <input 
                type="range"
                class="range range-sm range-primary"
                min="5"
                max="100"
                [ngModel]="service.graphOptions().bins || 30"
                (ngModelChange)="updateOption('bins', $event)"
              />
              <span class="text-xs text-base-content/60">{{ service.graphOptions().bins || 30 }} bins</span>
            </div>
          }

          <!-- Position (for bar charts) -->
          @if (isBarChart()) {
            <div class="form-group">
              <label class="form-label">Bar Position</label>
              <select 
                class="select select-bordered select-sm w-full"
                [ngModel]="service.graphOptions().position || 'stack'"
                (ngModelChange)="updateOption('position', $event)"
              >
                <option value="stack">Stacked</option>
                <option value="dodge">Grouped (side by side)</option>
                <option value="fill">Proportional (100%)</option>
              </select>
            </div>
          }

          <!-- Alpha (transparency) -->
          <div class="form-group">
            <label class="form-label">Transparency</label>
            <input 
              type="range"
              class="range range-sm"
              min="0.1"
              max="1"
              step="0.1"
              [ngModel]="service.graphOptions().alpha || 0.8"
              (ngModelChange)="updateOption('alpha', $event)"
            />
            <span class="text-xs text-base-content/60">{{ (service.graphOptions().alpha || 0.8) * 100 | number:'1.0-0' }}%</span>
          </div>

          <!-- Color By (optional) -->
          @if (factorColumns.length > 0 && supportsColor()) {
            <div class="form-group">
              <label class="form-label">Color By (optional)</label>
              <select 
                class="select select-bordered select-sm w-full"
                [ngModel]="service.graphOptions().colorBy || ''"
                (ngModelChange)="updateOption('colorBy', $event || undefined)"
              >
                <option value="">Default</option>
                @for (col of factorColumns; track col.name) {
                  <option [value]="col.name">{{ col.name }}</option>
                }
              </select>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .graph-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
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

    .graph-type-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .graph-type-card {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 2px solid transparent;
    }

    .graph-type-card:hover {
      background: hsl(var(--b3));
    }

    .graph-type-card.selected {
      border-color: hsl(var(--p));
      background: hsl(var(--p) / 0.1);
    }

    .graph-type-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .graph-type-icon {
      font-size: 1.25rem;
    }

    .graph-type-label {
      font-size: 0.875rem;
    }

    .graph-options {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid hsl(var(--b3));
    }

    .options-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .empty-state {
      background: hsl(var(--b2));
      border-radius: 0.5rem;
      padding: 1.5rem;
      text-align: center;
    }
  `],
})
export class GraphPanelComponent {
  @Input() columns: ColumnInfo[] = [];
  @Input() factorColumns: ColumnInfo[] = [];

  readonly service = inject(DescribeDialogService);

  getGraphIcon(type: GraphType): string {
    const icons: Record<GraphType, string> = {
      'histogram': '📊',
      'density': '〰️',
      'boxplot': '📦',
      'violin': '🎻',
      'bar-chart': '📶',
      'pie-chart': '🥧',
      'scatter': '⚬',
      'line': '📈',
      'jitter': '⋮⋮',
      'summary-plot': '➖',
      'mosaic': '🔲',
      'stacked-bar': '▤',
      'grouped-bar': '▥',
      'scatter-matrix': '⊞',
      'correlation-heatmap': '🔥',
      // Composite graphs
      'boxplot-jitter': '📦⋮',
      'violin-boxplot': '🎻📦',
      'violin-jitter': '🎻⋮',
      'line-points': '📈⚬',
    };
    return icons[type] || '📊';
  }

  updateOption(key: string, value: unknown): void {
    this.service.updateGraphOptions({ [key]: value });
  }

  supportsFlip(): boolean {
    const type = this.service.graphType();
    return ['boxplot', 'violin', 'bar-chart', 'stacked-bar', 'grouped-bar', 'jitter'].includes(type || '');
  }

  supportsLabels(): boolean {
    const type = this.service.graphType();
    return ['bar-chart', 'stacked-bar', 'grouped-bar'].includes(type || '');
  }

  supportsColor(): boolean {
    const type = this.service.graphType();
    return ['scatter', 'scatter-matrix', 'line', 'line-points', 'jitter', 'density', 'boxplot-jitter', 'violin-jitter'].includes(type || '');
  }

  isBarChart(): boolean {
    const type = this.service.graphType();
    return ['bar-chart', 'stacked-bar', 'grouped-bar'].includes(type || '');
  }
}
