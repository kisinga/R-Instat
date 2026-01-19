import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../../core/services/r.service';

/**
 * R Health Overlay Component
 * 
 * Displays a blocking overlay when R is not ready:
 * - Starting: Shows loading spinner
 * - Missing packages: Shows package list and install button
 * - Installing: Shows installation progress
 * - Error: Shows error message with retry option
 * 
 * This prevents users from attempting operations that would fail.
 */
@Component({
  selector: 'app-r-health-overlay',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    @if (showOverlay()) {
      <div class="health-overlay">
        <div class="health-card">
          <!-- Starting State -->
          @if (status().status === 'starting') {
            <div class="text-center">
              <span class="loading loading-spinner loading-lg text-primary"></span>
              <h2 class="text-xl font-semibold mt-4">{{ 'R_HEALTH.STARTING_TITLE' | translate }}</h2>
              <p class="text-base-content/70 mt-2">{{ 'R_HEALTH.STARTING_DESC' | translate }}</p>
            </div>
          }

          <!-- Missing Packages State -->
          @if (status().status === 'missing_packages') {
            <div class="text-center">
              <div class="text-warning text-5xl mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 class="text-xl font-semibold">{{ 'R_HEALTH.MISSING_PACKAGES_TITLE' | translate }}</h2>
              <p class="text-base-content/70 mt-2 mb-4">
                {{ 'R_HEALTH.MISSING_PACKAGES_DESC' | translate }}
              </p>
              
              <div class="bg-base-200 rounded-lg p-3 mb-4 max-w-sm mx-auto">
                <ul class="text-left text-sm font-mono">
                  @for (pkg of status().missingPackages; track pkg) {
                    <li class="py-1">{{ pkg }}</li>
                  }
                </ul>
              </div>

              <div class="flex flex-col gap-2">
                <button 
                  class="btn btn-primary"
                  (click)="installPackages()"
                  [disabled]="isInstalling()"
                >
                  {{ 'R_HEALTH.INSTALL_PACKAGES' | translate }}
                </button>
                <p class="text-xs text-base-content/50">
                  {{ 'R_HEALTH.INSTALL_MANUAL' | translate }} <code class="bg-base-200 px-1 rounded">install.packages(c(...))</code>
                </p>
              </div>
            </div>
          }

          <!-- Installing State -->
          @if (status().status === 'installing') {
            <div class="text-center">
              <span class="loading loading-spinner loading-lg text-primary"></span>
              <h2 class="text-xl font-semibold mt-4">{{ 'R_HEALTH.INSTALLING_TITLE' | translate }}</h2>
              
              @if (status().installProgress) {
                <p class="text-base-content/70 mt-2">
                  {{ 'R_HEALTH.INSTALLING_DESC' | translate: {package: status().installProgress?.package} }}
                </p>
                <div class="w-full max-w-xs mx-auto mt-4">
                  <progress 
                    class="progress progress-primary w-full" 
                    [value]="status().installProgress?.current" 
                    [max]="status().installProgress?.total"
                  ></progress>
                  <p class="text-sm text-base-content/50 mt-1">
                    {{ status().installProgress?.current }} / {{ status().installProgress?.total }}
                  </p>
                </div>
              }

              <p class="text-xs text-base-content/50 mt-4">
                {{ 'R_HEALTH.INSTALLING_WAIT' | translate }}
              </p>
            </div>
          }

          <!-- Error State -->
          @if (status().status === 'error') {
            <div class="text-center">
              <div class="text-error text-5xl mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 class="text-xl font-semibold">{{ 'R_HEALTH.ERROR_TITLE' | translate }}</h2>
              <p class="text-base-content/70 mt-2 mb-4">
                {{ status().error || ('R_HEALTH.ERROR_DESC' | translate) }}
              </p>

              <div class="flex flex-col gap-2">
                <button 
                  class="btn btn-primary"
                  (click)="retry()"
                  [disabled]="isRetrying()"
                >
                  @if (isRetrying()) {
                    <span class="loading loading-spinner loading-sm"></span>
                  }
                  {{ 'R_HEALTH.RETRY' | translate }}
                </button>
                <p class="text-xs text-base-content/50">
                  {{ 'R_HEALTH.RETRY_HINT' | translate }}
                </p>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .health-overlay {
      @apply fixed inset-0 bg-base-100/95 backdrop-blur-sm flex items-center justify-center z-50;
    }

    .health-card {
      @apply bg-base-100 border border-base-300 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4;
    }
  `]
})
export class RHealthOverlayComponent {
  private readonly rService = inject(RService);

  readonly status = this.rService.healthStatus;
  readonly isInstalling = computed(() => this.status().status === 'installing');
  readonly isRetrying = computed(() => false); // TODO: track retry state if needed

  // Show overlay when R is not ready
  readonly showOverlay = computed(() => {
    const status = this.status().status;
    return status !== 'ready';
  });

  async installPackages(): Promise<void> {
    try {
      await this.rService.installPackages();
    } catch (error) {
      console.error('Failed to install packages:', error);
    }
  }

  async retry(): Promise<void> {
    try {
      await this.rService.restartR();
    } catch (error) {
      console.error('Failed to restart R:', error);
    }
  }
}
