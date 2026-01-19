import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RService } from '../../core/services/r.service';
import { ThemeService } from '../../core/services/theme.service';
import { LanguageService } from '../../core/services/language.service';
import { DomainExpertService } from '../../core/services/domain-expert.service';

interface MenuItem {
  labelKey: string;
  action: string;
  shortcut?: string;
  dividerAfter?: boolean;
}

interface MenuGroup {
  labelKey: string;
  icon: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="h-11 bg-base-100 border-b border-base-300 flex items-center px-2 gap-0.5 no-select">
      <!-- Menu Dropdowns -->
      @for (menu of menus(); track menu.labelKey) {
        <div class="dropdown">
          <button 
            tabindex="0" 
            class="menu-trigger"
          >
            <span class="menu-icon" [innerHTML]="menu.icon"></span>
            <span class="menu-label">{{ menu.labelKey | translate }}</span>
            <svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-50 w-52 p-2 shadow-lg border border-base-300">
            @for (item of menu.items; track item.action) {
              <li>
                <button (click)="handleAction(item.action)" class="flex justify-between">
                  <span>{{ item.labelKey | translate }}</span>
                  @if (item.shortcut) {
                    <kbd class="kbd kbd-xs opacity-60">{{ item.shortcut }}</kbd>
                  }
                </button>
              </li>
              @if (item.dividerAfter) {
                <li class="menu-divider"></li>
              }
            }
          </ul>
        </div>
      }

      <div class="flex-1"></div>

      <!-- Language Selector Dropdown -->
      <div class="dropdown dropdown-end">
        <button 
          tabindex="0" 
          class="menu-trigger"
          [attr.aria-label]="'MENU.LANGUAGE' | translate"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <span class="menu-label">{{ languageService.currentLangName() }}</span>
          <svg class="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        class="menu-trigger"
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
    .menu-trigger {
      @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm text-base-content/80 
             hover:bg-base-200 hover:text-base-content transition-colors cursor-pointer;
    }

    .menu-trigger:active,
    .dropdown:focus-within .menu-trigger {
      @apply bg-base-200 text-base-content;
    }

    .menu-icon {
      @apply text-base;
    }

    .menu-label {
      @apply text-xs font-medium;
    }

    .menu-divider {
      @apply h-px bg-base-300 my-1;
    }

    .dropdown-content {
      @apply mt-1;
    }

    .dropdown-content button {
      @apply text-sm;
    }
  `]
})
export class ToolbarComponent {
  readonly rService = inject(RService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly domainService = inject(DomainExpertService);

  /** Static menus that don't change */
  readonly staticMenus: MenuGroup[] = [
    {
      labelKey: 'TOOLBAR.MENU_DATA',
      icon: '📂',
      items: [
        { labelKey: 'TOOLBAR.IMPORT', action: 'import', shortcut: 'Ctrl+I' },
        { labelKey: 'TOOLBAR.EXPORT', action: 'export', dividerAfter: true },
        { labelKey: 'TOOLBAR.FILTER', action: 'filter' },
        { labelKey: 'TOOLBAR.SORT', action: 'sort', dividerAfter: true },
        { labelKey: 'TOOLBAR.CALCULATE', action: 'calculate' },
        { labelKey: 'TOOLBAR.RECODE', action: 'recode' },
        { labelKey: 'TOOLBAR.RENAME', action: 'rename', dividerAfter: true },
        { labelKey: 'TOOLBAR.STACK', action: 'stack' },
        { labelKey: 'TOOLBAR.UNSTACK', action: 'unstack' },
        { labelKey: 'TOOLBAR.MERGE', action: 'merge' },
      ]
    },
    {
      labelKey: 'TOOLBAR.MENU_ANALYZE',
      icon: '📊',
      items: [
        { labelKey: 'TOOLBAR.DESCRIBE', action: 'describe', shortcut: 'Ctrl+D' },
        { labelKey: 'TOOLBAR.SUMMARY', action: 'summary' },
      ]
    },
    {
      labelKey: 'TOOLBAR.MENU_VISUALIZE',
      icon: '📈',
      items: [
        { labelKey: 'TOOLBAR.HISTOGRAM', action: 'histogram' },
        { labelKey: 'TOOLBAR.BOX_PLOT', action: 'boxplot' },
        { labelKey: 'TOOLBAR.SCATTER', action: 'scatter' },
        { labelKey: 'TOOLBAR.BAR_CHART', action: 'bar-chart' },
        { labelKey: 'TOOLBAR.LINE_PLOT', action: 'line-plot' },
        { labelKey: 'TOOLBAR.DOT_PLOT', action: 'dot-plot' },
      ]
    },
    {
      labelKey: 'TOOLBAR.MENU_MODEL',
      icon: '🧮',
      items: [
        { labelKey: 'TOOLBAR.CORRELATION', action: 'correlation' },
        { labelKey: 'TOOLBAR.TTEST', action: 't-test' },
        { labelKey: 'TOOLBAR.REGRESSION', action: 'regression' },
      ]
    }
  ];

  /** Domain Expert menu - dynamic based on active domain */
  readonly domainExpertMenu = computed<MenuGroup>(() => {
    const domain = this.domainService.activeDomain();
    
    if (domain) {
      // Domain is active - show domain name and its dialogs
      const items: MenuItem[] = domain.dialogs.map(d => ({
        labelKey: d.labelKey,
        action: d.action,
      }));
      // Add divider and change domain option
      if (items.length > 0) {
        items[items.length - 1].dividerAfter = true;
      }
      items.push({ labelKey: 'TOOLBAR.CHANGE_DOMAIN', action: 'domain-selector' });
      
      return {
        labelKey: domain.labelKey,
        icon: domain.icon,
        items,
      };
    }
    
    // No domain active - show select domain option
    return {
      labelKey: 'TOOLBAR.MENU_DOMAIN_EXPERT',
      icon: '🎯',
      items: [
        { labelKey: 'TOOLBAR.SELECT_DOMAIN', action: 'domain-selector' }
      ]
    };
  });

  /** All menus including dynamic Domain Expert */
  readonly menus = computed<MenuGroup[]>(() => {
    return [...this.staticMenus, this.domainExpertMenu()];
  });

  handleAction(action: string): void {
    // Close dropdown
    (document.activeElement as HTMLElement)?.blur();
    
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
    (document.activeElement as HTMLElement)?.blur();
  }
}
