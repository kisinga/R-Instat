import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { RService } from '../../core/services/r.service';
import { OutputEntry } from '../../core/models/r.model';

@Component({
  selector: 'app-output-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="output-panel-container flex flex-col bg-base-100">
      <!-- Header -->
      <div class="flex-shrink-0 panel-header bg-base-200 border-b border-base-300">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ 'OUTPUT.TITLE' | translate }}</span>
          <span class="badge badge-sm badge-ghost">{{ entries().length }}</span>
        </div>
        <div class="flex items-center gap-1">
          <button 
            class="btn btn-ghost btn-xs"
            (click)="toggleCodeDisplay()"
            [class.btn-active]="showCode()"
            [title]="'OUTPUT.TOGGLE_CODE' | translate"
          >
            <span class="text-xs font-mono">&lt;/&gt;</span>
          </button>
          <button 
            class="btn btn-ghost btn-xs"
            (click)="clearOutput()"
            [title]="'OUTPUT.CLEAR' | translate"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Output Content -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        @if (entries().length === 0) {
          <div class="text-center text-base-content/50 py-12">
            <div class="text-4xl mb-2">📋</div>
            <p>{{ 'OUTPUT.EMPTY_MESSAGE' | translate }}</p>
            <p class="text-sm">{{ 'OUTPUT.EMPTY_HINT' | translate }}</p>
          </div>
        } @else {
          @for (entry of entries(); track entry.id) {
            <div class="output-entry pb-4">
              <!-- Timestamp -->
              <div class="text-xs text-base-content/40 mb-2 flex items-center justify-between">
                <span>{{ entry.timestamp | date:'HH:mm:ss' }}</span>
                <span>{{ entry.duration }}ms</span>
              </div>

              <!-- R Code -->
              @if (showCode()) {
                <div class="output-code">
                  <pre class="text-xs whitespace-pre-wrap">{{ entry.code }}</pre>
                </div>
              }

              <!-- Result -->
              @if (entry.result.success) {
                @switch (entry.result.result?.type) {
                  @case ('text') {
                    <pre class="output-result whitespace-pre-wrap font-mono text-sm bg-base-200 p-3 rounded-lg overflow-x-auto">{{ formatTextOutput(entry.result.result?.value) }}</pre>
                  }
                  @case ('plot') {
                    <div class="output-plot">
                      <img 
                        [src]="entry.result.result?.dataUrl || entry.result.result?.path" 
                        [alt]="'OUTPUT.PLOT_ALT' | translate"
                        class="max-w-full rounded-lg shadow-lg"
                        loading="lazy"
                      />
                    </div>
                  }
                  @case ('dataframe') {
                    <div class="overflow-x-auto">
                      <div class="text-xs text-base-content/60 mb-1">
                        {{ 'OUTPUT.SHOWING_ROWS' | translate: {shown: entry.result.result?.data?.length || 0, total: entry.result.result?.totalRows || 0} }}
                      </div>
                      <table class="table table-xs table-zebra">
                        <thead>
                          <tr>
                            @for (col of entry.result.result?.columns || []; track col) {
                              <th>{{ col }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of entry.result.result?.data || []; track $index) {
                            <tr>
                              @for (col of entry.result.result?.columns || []; track col) {
                                <td>{{ formatCellValue(row, col) }}</td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                  @default {
                    <div class="text-base-content/70 text-sm">
                      {{ 'OUTPUT.SUCCESS_DEFAULT' | translate }}
                    </div>
                  }
                }
              } @else {
                <div class="output-error">
                  <div class="font-medium mb-1">{{ 'OUTPUT.ERROR' | translate }}</div>
                  <div>{{ entry.result.error }}</div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .output-panel-container {
      height: 100%;
      overflow: hidden;
    }
  `]
})
export class OutputPanelComponent implements OnInit, OnDestroy {
  private readonly rService = inject(RService);
  private subscription?: Subscription;

  entries = signal<OutputEntry[]>([]);
  showCode = signal(true);

  ngOnInit(): void {
    this.subscription = this.rService.output$.subscribe(entries => {
      this.entries.set(entries);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  toggleCodeDisplay(): void {
    this.showCode.update(v => !v);
  }

  clearOutput(): void {
    this.rService.clearHistory();
  }

  formatTextOutput(value: unknown): string {
    if (Array.isArray(value)) {
      return value.join('\n');
    }
    return String(value || '');
  }

  formatCellValue(row: Record<string, unknown>, col: string): string {
    const value = row[col];
    if (value === null || value === undefined) {
      return 'NA';
    }
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value.toString() : value.toFixed(4);
    }
    return String(value);
  }
}
