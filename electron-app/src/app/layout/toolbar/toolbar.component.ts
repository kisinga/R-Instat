import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../core/services/r.service';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';

interface ToolbarButton {
  icon: string;
  labelKey: string;  // Translation key
  action: string;
  shortcut?: string;
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="h-11 bg-base-100 border-b border-base-300 flex items-center px-3 gap-1 no-select">
      @for (btn of buttons; track btn.action) {
        <button 
          class="toolbar-btn"
          [attr.title]="(btn.labelKey | translate) + (btn.shortcut ? ' (' + btn.shortcut + ')' : '')"
          (click)="handleAction(btn.action)"
        >
          <span class="toolbar-icon" [innerHTML]="btn.icon"></span>
          <span class="toolbar-label">{{ btn.labelKey | translate }}</span>
        </button>
      }

      <div class="divider-v"></div>

      @for (btn of graphButtons; track btn.action) {
        <button 
          class="toolbar-btn"
          [attr.title]="btn.labelKey | translate"
          (click)="handleAction(btn.action)"
        >
          <span class="toolbar-icon" [innerHTML]="btn.icon"></span>
          <span class="toolbar-label">{{ btn.labelKey | translate }}</span>
        </button>
      }

      <div class="flex-1"></div>

      <!-- Language Selector Dropdown -->
      <div class="dropdown dropdown-end">
        <button 
          tabindex="0" 
          class="toolbar-btn gap-1"
          [attr.aria-label]="'MENU.LANGUAGE' | translate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span class="toolbar-label">{{ languageService.currentLangName() }}</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 w-40 p-2 shadow-lg border border-base-300">
          @for (lang of languageService.supportedLanguages; track lang.code) {
            <li>
              <button 
                (click)="setLanguage(lang.code)"
                [class.active]="languageService.currentLang() === lang.code"
              >
                {{ lang.nativeName }}
              </button>
            </li>
          }
        </ul>
      </div>

      <!-- Theme Toggle -->
      <button 
        class="toolbar-btn"
        (click)="toggleTheme()"
        [attr.title]="themeService.isDark() ? ('MENU.THEME_LIGHT' | translate) : ('MENU.THEME_DARK' | translate)"
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
  readonly languageService = inject(LanguageService);

  buttons: ToolbarButton[] = [
    { icon: '📂', labelKey: 'TOOLBAR.IMPORT', action: 'import', shortcut: 'Ctrl+I' },
    { icon: '💾', labelKey: 'TOOLBAR.SAVE', action: 'save', shortcut: 'Ctrl+S' },
    { icon: '📊', labelKey: 'TOOLBAR.SUMMARY', action: 'summary' },
    { icon: '🔍', labelKey: 'TOOLBAR.FILTER', action: 'filter' },
    { icon: '🔢', labelKey: 'TOOLBAR.CALCULATE', action: 'calculate' },
  ];

  graphButtons: ToolbarButton[] = [
    { icon: '📊', labelKey: 'TOOLBAR.HISTOGRAM', action: 'histogram' },
    { icon: '📦', labelKey: 'TOOLBAR.BOX_PLOT', action: 'boxplot' },
    { icon: '⬡', labelKey: 'TOOLBAR.SCATTER', action: 'scatter' },
    { icon: '📈', labelKey: 'TOOLBAR.BAR_CHART', action: 'bar-chart' },
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

  setLanguage(langCode: string): void {
    this.languageService.setLanguage(langCode);
    // Close dropdown by blurring active element
    (document.activeElement as HTMLElement)?.blur();
  }
}
