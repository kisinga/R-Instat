import { Injectable, NgZone, inject } from '@angular/core';
import { RService } from './r.service';

/**
 * Keyboard Service - Global keyboard shortcut handling
 */
@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private readonly rService = inject(RService);
  private readonly ngZone = inject(NgZone);
  private initialized = false;

  /**
   * Initialize keyboard shortcuts
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener('keydown', (event) => {
      this.ngZone.run(() => this.handleKeydown(event));
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    // Don't trigger shortcuts if typing in input
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      // Allow Escape to work even in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    // Global shortcuts
    if (isCtrlOrCmd) {
      switch (event.key.toLowerCase()) {
        case 'i':
          event.preventDefault();
          this.rService.openDialog('import');
          break;
        case 's':
          event.preventDefault();
          // Save functionality
          break;
        case 'f':
          event.preventDefault();
          this.rService.openDialog('filter');
          break;
        case 'h':
          if (isShift) {
            event.preventDefault();
            this.rService.openDialog('histogram');
          }
          break;
        case 'b':
          if (isShift) {
            event.preventDefault();
            this.rService.openDialog('boxplot');
          }
          break;
      }
    }

    // Non-modifier shortcuts
    switch (event.key) {
      case 'F5':
        event.preventDefault();
        this.rService.refreshDataframes();
        break;
    }
  }
}
