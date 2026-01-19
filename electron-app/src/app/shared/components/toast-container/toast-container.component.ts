import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container">
      @for (toast of toastService.toasts(); track toast.id) {
        <div 
          class="toast-item alert"
          [class.alert-info]="toast.type === 'info'"
          [class.alert-success]="toast.type === 'success'"
          [class.alert-warning]="toast.type === 'warning'"
          [class.alert-error]="toast.type === 'error'"
        >
          <span>{{ toast.message }}</span>
          <button 
            class="btn btn-ghost btn-xs"
            (click)="dismiss(toast.id)"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
