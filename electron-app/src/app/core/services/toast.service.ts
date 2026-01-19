import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  duration: number;
}

/**
 * Toast Service - Manages toast notifications
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly DEFAULT_DURATION = 4000;

  /**
   * Show info toast
   */
  info(message: string, duration = this.DEFAULT_DURATION): void {
    this.show({ message, type: 'info', duration });
  }

  /**
   * Show success toast
   */
  success(message: string, duration = this.DEFAULT_DURATION): void {
    this.show({ message, type: 'success', duration });
  }

  /**
   * Show warning toast
   */
  warning(message: string, duration = this.DEFAULT_DURATION): void {
    this.show({ message, type: 'warning', duration });
  }

  /**
   * Show error toast
   */
  error(message: string, duration = 6000): void {
    this.show({ message, type: 'error', duration });
  }

  /**
   * Show toast with options
   */
  private show(options: Omit<Toast, 'id'>): void {
    const toast: Toast = {
      ...options,
      id: crypto.randomUUID(),
    };

    this._toasts.update(toasts => [...toasts, toast]);

    // Auto-dismiss
    setTimeout(() => {
      this.dismiss(toast.id);
    }, toast.duration);
  }

  /**
   * Dismiss a toast by ID
   */
  dismiss(id: string): void {
    this._toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  /**
   * Dismiss all toasts
   */
  dismissAll(): void {
    this._toasts.set([]);
  }
}
