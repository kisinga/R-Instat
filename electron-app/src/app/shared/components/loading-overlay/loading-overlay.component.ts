import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (show) {
      <div class="loading-overlay">
        <div class="loading-content">
          <span class="loading loading-spinner loading-lg text-primary"></span>
          @if (message) {
            <p class="mt-4 text-base-content/70">{{ message }}</p>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .loading-overlay {
      @apply absolute inset-0 bg-base-100/80 backdrop-blur-sm flex items-center justify-center z-40;
    }

    .loading-content {
      @apply text-center;
    }
  `]
})
export class LoadingOverlayComponent {
  @Input() show = false;
  @Input() message = '';
}
