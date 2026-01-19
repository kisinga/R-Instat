import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-menubar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <header class="h-10 bg-base-200 border-b border-base-300 flex items-center justify-end px-2 gap-1 no-select">
      <!-- Spacer (logo/title is in Electron window title, menu is native) -->
      <div class="flex-1"></div>

      <!-- Language Selector Dropdown -->
      <div class="dropdown dropdown-end">
        <button 
          tabindex="0" 
          class="btn btn-ghost btn-sm gap-1"
          [attr.aria-label]="'MENU.LANGUAGE' | translate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span class="text-xs">{{ languageService.currentLangName() }}</span>
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
        class="btn btn-ghost btn-sm btn-square"
        (click)="toggleTheme()"
        [attr.aria-label]="themeService.isDark() ? ('MENU.THEME_LIGHT' | translate) : ('MENU.THEME_DARK' | translate)"
      >
        @if (themeService.isDark()) {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        }
      </button>
    </header>
  `,
})
export class MenubarComponent {
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  setLanguage(langCode: string): void {
    this.languageService.setLanguage(langCode);
    // Close dropdown by blurring active element
    (document.activeElement as HTMLElement)?.blur();
  }
}
