import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../core/services/r.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-statusbar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <footer class="h-7 bg-base-200 border-t border-base-300 flex items-center px-3 text-xs no-select">
      <!-- Unified Status -->
      <div class="flex items-center gap-2">
        @if (isProcessing()) {
          <span class="loading loading-spinner loading-xs"></span>
        } @else {
          <div 
            class="w-2 h-2 rounded-full"
            [ngClass]="{
              'bg-success': healthStatus() === 'ready',
              'bg-warning': healthStatus() === 'missing_packages' || healthStatus() === 'installing',
              'bg-error': healthStatus() === 'error',
              'bg-base-content/30': healthStatus() === 'starting',
              'animate-pulse': healthStatus() !== 'ready'
            }"
          ></div>
        }
        <span class="text-base-content/70">
          {{ statusTextKey() | translate }}
        </span>
      </div>

      <div class="divider-v"></div>

      <!-- Active Dataframe -->
      <div class="flex items-center gap-2">
        <span class="text-base-content/50">{{ 'STATUS.DATA' | translate }}:</span>
        <span class="font-medium">
          {{ activeDataframe() || ('STATUS.NONE' | translate) }}
        </span>
      </div>

      @if (dataframeCount() > 0) {
        <div class="divider-v"></div>
        <div class="text-base-content/70">
          {{ dataframeCount() }} {{ dataframeCount() > 1 ? ('STATUS.DATAFRAMES' | translate) : ('STATUS.DATAFRAME' | translate) }}
        </div>
      }

      <div class="flex-1"></div>
    </footer>
  `,
  styles: [`
    .divider-v {
      @apply w-px h-4 bg-base-300 mx-3;
    }
  `]
})
export class StatusbarComponent {
  readonly rService = inject(RService);
  private readonly languageService = inject(LanguageService);

  activeDataframe = computed(() => this.rService.activeDataframe());
  dataframeCount = computed(() => this.rService.dataframes().length);
  healthStatus = computed(() => this.rService.healthStatus().status);
  
  // True when R is ready and actively processing a command
  isProcessing = computed(() => 
    this.healthStatus() === 'ready' && this.rService.isLoading()
  );
  
  // Return the translation key based on current state
  statusTextKey = computed(() => {
    // Processing takes priority when R is ready
    if (this.isProcessing()) {
      return 'STATUS.PROCESSING';
    }
    
    // Otherwise show health status
    switch (this.healthStatus()) {
      case 'ready':
        return 'STATUS.READY';
      case 'starting':
        return 'STATUS.R_STARTING';
      case 'missing_packages':
        return 'STATUS.R_MISSING_PACKAGES';
      case 'installing':
        return 'STATUS.R_INSTALLING';
      case 'error':
        return 'STATUS.R_ERROR';
      default:
        return 'STATUS.R_UNKNOWN';
    }
  });
}
