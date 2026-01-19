import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RService } from '../../core/services/r.service';
import { ThemeService } from '../../core/services/theme.service';

interface ToolbarButton {
  icon: string;
  label: string;
  action: string;
  shortcut?: string;
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-11 bg-base-100 border-b border-base-300 flex items-center px-3 gap-1 no-select">
      @for (btn of buttons; track btn.action) {
        <button 
          class="toolbar-btn"
          [attr.title]="btn.label + (btn.shortcut ? ' (' + btn.shortcut + ')' : '')"
          (click)="handleAction(btn.action)"
        >
          <span class="toolbar-icon" [innerHTML]="btn.icon"></span>
          <span class="toolbar-label">{{ btn.label }}</span>
        </button>
      }

      <div class="divider-v"></div>

      @for (btn of graphButtons; track btn.action) {
        <button 
          class="toolbar-btn"
          [attr.title]="btn.label"
          (click)="handleAction(btn.action)"
        >
          <span class="toolbar-icon" [innerHTML]="btn.icon"></span>
          <span class="toolbar-label">{{ btn.label }}</span>
        </button>
      }

      <div class="flex-1"></div>

      <!-- Theme Toggle -->
      <button 
        class="toolbar-btn"
        (click)="toggleTheme()"
        [attr.title]="themeService.isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
      >
        @if (themeService.isDark()) {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        }
      </button>
    </div>
  `,
  styles: [`
    .toolbar-btn {
      @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm text-base-content/80 
             hover:bg-base-200 hover:text-base-content transition-colors;
    }

    .toolbar-btn:active {
      @apply bg-base-300;
    }

    .toolbar-icon {
      @apply text-base;
    }

    .toolbar-label {
      @apply hidden lg:inline text-xs;
    }

    .divider-v {
      @apply w-px h-6 bg-base-300 mx-2;
    }
  `]
})
export class ToolbarComponent {
  readonly rService = inject(RService);
  readonly themeService = inject(ThemeService);

  buttons: ToolbarButton[] = [
    { icon: '📂', label: 'Import', action: 'import', shortcut: 'Ctrl+I' },
    { icon: '💾', label: 'Save', action: 'save', shortcut: 'Ctrl+S' },
    { icon: '📊', label: 'Summary', action: 'summary' },
    { icon: '🔍', label: 'Filter', action: 'filter' },
    { icon: '🔢', label: 'Calculate', action: 'calculate' },
  ];

  graphButtons: ToolbarButton[] = [
    { icon: '📊', label: 'Histogram', action: 'histogram' },
    { icon: '📦', label: 'Box Plot', action: 'boxplot' },
    { icon: '⬡', label: 'Scatter', action: 'scatter' },
    { icon: '📈', label: 'Bar Chart', action: 'bar-chart' },
  ];

  handleAction(action: string): void {
    if (action === 'save') {
      // Handle save action
      return;
    }
    this.rService.openDialog(action);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
