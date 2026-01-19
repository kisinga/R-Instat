import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from './layout/shell/shell.component';
import { RService } from './core/services/r.service';
import { ThemeService } from './core/services/theme.service';
import { KeyboardService } from './core/services/keyboard.service';
import { LanguageService } from './core/services/language.service';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { RHealthOverlayComponent } from './shared/components/r-health-overlay/r-health-overlay.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    ShellComponent,
    ToastContainerComponent,
    RHealthOverlayComponent,
  ],
  template: `
    <app-shell />
    <app-toast-container />
    <app-r-health-overlay />
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly rService = inject(RService);
  private readonly themeService = inject(ThemeService);
  private readonly keyboardService = inject(KeyboardService);
  private readonly languageService = inject(LanguageService);
  private cleanupMenuListener?: () => void;

  ngOnInit(): void {
    // Initialize theme
    this.themeService.initTheme();

    // Initialize language
    this.languageService.initLanguage();

    // Initialize keyboard shortcuts
    this.keyboardService.init();

    // Listen for menu commands from Electron
    if (window.electronAPI) {
      this.cleanupMenuListener = window.electronAPI.onMenuCommand((command, data) => {
        this.handleMenuCommand(command, data);
      });
    }

    // R health is now managed by RHealthOverlayComponent
  }

  ngOnDestroy(): void {
    this.cleanupMenuListener?.();
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
