import { Component, Output, EventEmitter, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RService } from '../../core/services/r.service';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex items-center justify-center welcome-hero p-8">
      <div class="max-w-2xl text-center">
        <!-- Logo -->
        <div class="mb-8">
          <div class="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-primary/20 mb-4">
            <span class="text-5xl font-bold text-primary">R</span>
          </div>
          <h1 class="text-4xl font-bold mb-2">R-Instat</h1>
          <p class="text-lg text-base-content/70">
            Cross-platform statistical analysis powered by R
          </p>
        </div>

        <!-- Quick Actions -->
        <div class="grid gap-4 sm:grid-cols-2 mb-8">
          <button 
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left p-6 border border-base-300 hover:border-primary/50 disabled:opacity-70 disabled:cursor-wait"
            (click)="onLoadDemo()"
            [disabled]="isLoading()">
            <div class="flex items-start gap-4">
              <div class="p-3 rounded-lg bg-primary/20 text-primary">
                <span class="loading loading-spinner loading-md" [class.hidden]="!isLoading()"></span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" [class.hidden]="isLoading()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold mb-1">
                  {{ isLoading() ? 'Loading Demo Data...' : 'Load Demo Data' }}
                </h3>
                <p class="text-sm text-base-content/60">
                  {{ isLoading() ? 'Please wait while we load the dataset' : 'Explore with World Bank Tanzania dataset' }}
                </p>
              </div>
            </div>
          </button>

          <button 
            class="card bg-base-200 hover:bg-base-300 transition-colors cursor-pointer text-left p-6 border border-base-300 hover:border-secondary/50"
            (click)="openImport()"
          >
            <div class="flex items-start gap-4">
              <div class="p-3 rounded-lg bg-secondary/20 text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold mb-1">Import Data</h3>
                <p class="text-sm text-base-content/60">
                  Load CSV, Excel, or other data files
                </p>
              </div>
            </div>
          </button>
        </div>

        <!-- Features -->
        <div class="grid grid-cols-3 gap-6 text-center text-sm">
          <div>
            <div class="text-2xl mb-2">📊</div>
            <div class="font-medium">Data Analysis</div>
            <div class="text-base-content/60">Summary statistics & exploration</div>
          </div>
          <div>
            <div class="text-2xl mb-2">📈</div>
            <div class="font-medium">Visualization</div>
            <div class="text-base-content/60">Charts, plots & graphs</div>
          </div>
          <div>
            <div class="text-2xl mb-2">🔬</div>
            <div class="font-medium">Statistical Models</div>
            <div class="text-base-content/60">Regression, tests & more</div>
          </div>
        </div>

        <!-- Version -->
        <div class="mt-12 text-xs text-base-content/40">
          Version 0.1.0 (MVP) • Powered by R
        </div>
      </div>
    </div>
  `,
})
export class WelcomeComponent {
  @Output() loadDemo = new EventEmitter<void>();
  
  private readonly rService = inject(RService);
  
  // Use the service's loading state for consistent UI feedback
  isLoading = computed(() => this.rService.isLoading());

  onLoadDemo(): void {
    if (this.isLoading()) return;
    this.loadDemo.emit();
  }

  openImport(): void {
    this.rService.openDialog('import');
  }
}
