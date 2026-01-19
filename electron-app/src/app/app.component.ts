import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from './layout/shell/shell.component';
import { RService } from './core/services/r.service';
import { ThemeService } from './core/services/theme.service';
import { ToastService } from './core/services/toast.service';
import { KeyboardService } from './core/services/keyboard.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ShellComponent,
    ToastContainerComponent,
  ],
  template: `
    <app-shell />
    <app-toast-container />
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly rService = inject(RService);
  private readonly themeService = inject(ThemeService);
  private readonly toastService = inject(ToastService);
  private readonly keyboardService = inject(KeyboardService);
  private cleanupMenuListener?: () => void;

  ngOnInit(): void {
    // Initialize theme
    this.themeService.initTheme();

    // Initialize keyboard shortcuts
    this.keyboardService.init();

    // Listen for menu commands from Electron
    if (window.electronAPI) {
      this.cleanupMenuListener = window.electronAPI.onMenuCommand((command, data) => {
        this.handleMenuCommand(command, data);
      });
    }

    // Check R connection status
    this.checkRConnection();
  }

  ngOnDestroy(): void {
    this.cleanupMenuListener?.();
  }

  private async checkRConnection(): Promise<void> {
    try {
      const status = await this.rService.getStatus();
      if (!status.connected) {
        this.toastService.warning('R is not connected. Some features may not work.');
      }
    } catch {
      this.toastService.error('Failed to connect to R backend');
    }
  }

  private handleMenuCommand(command: string, data?: unknown): void {
    switch (command) {
      case 'import':
        this.rService.openDialog('import');
        break;
      case 'save':
        // Handle save
        break;
      case 'about':
        // Show about dialog
        break;
      case 'dialog':
        if (typeof data === 'string') {
          this.rService.openDialog(data);
        }
        break;
    }
  }
}
