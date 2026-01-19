import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RService } from '../../core/services/r.service';

@Component({
  selector: 'app-statusbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer class="h-7 bg-base-200 border-t border-base-300 flex items-center px-3 text-xs no-select">
      <!-- Status -->
      <div class="flex items-center gap-2">
        @if (rService.isLoading()) {
          <span class="loading loading-spinner loading-xs"></span>
          <span class="text-base-content/70">Processing...</span>
        } @else {
          <span class="text-success">●</span>
          <span class="text-base-content/70">Ready</span>
        }
      </div>

      <div class="divider-v"></div>

      <!-- Active Dataframe -->
      <div class="flex items-center gap-2">
        <span class="text-base-content/50">Data:</span>
        <span class="font-medium">
          {{ activeDataframe() || 'None' }}
        </span>
      </div>

      @if (dataframeCount() > 0) {
        <div class="divider-v"></div>
        <div class="text-base-content/70">
          {{ dataframeCount() }} dataframe{{ dataframeCount() > 1 ? 's' : '' }}
        </div>
      }

      <div class="flex-1"></div>

      <!-- R Connection Status -->
      <div class="flex items-center gap-2">
        <div 
          class="w-2 h-2 rounded-full"
          [class.bg-success]="rService.isConnected()"
          [class.bg-error]="!rService.isConnected()"
          [class.animate-pulse]="!rService.isConnected()"
        ></div>
        <span class="text-base-content/70">
          R {{ rService.isConnected() ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
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

  activeDataframe = computed(() => this.rService.activeDataframe());
  dataframeCount = computed(() => this.rService.dataframes().length);
}
