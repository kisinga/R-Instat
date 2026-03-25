/**
 * Generic Settings Dialog — tabbed container for all application settings.
 */

import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { AiSettingsDialogComponent } from '../ai-settings/ai-settings-dialog.component';

type SettingsTab = 'general' | 'ai';

@Component({
  selector: 'app-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, AiSettingsDialogComponent],
  template: `
    <div class="dialog-content settings-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'SETTINGS.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">&#10005;</button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <nav class="settings-sidebar">
          <button
            class="sidebar-item"
            [class.active]="activeTab() === 'general'"
            (click)="activeTab.set('general')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{{ 'SETTINGS.TAB_GENERAL' | translate }}</span>
          </button>
          <button
            class="sidebar-item"
            [class.active]="activeTab() === 'ai'"
            (click)="activeTab.set('ai')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{{ 'SETTINGS.TAB_AI' | translate }}</span>
          </button>
        </nav>

        <!-- Content -->
        <div class="settings-content">
          @switch (activeTab()) {
            @case ('general') {
              <div class="space-y-6">
                <!-- Appearance -->
                <section>
                  <h3 class="text-sm font-semibold mb-3">{{ 'SETTINGS.SECTION_APPEARANCE' | translate }}</h3>

                  <div class="flex items-center justify-between">
                    <span class="text-xs">{{ 'SETTINGS.THEME' | translate }}</span>
                    <button class="btn btn-sm btn-ghost" (click)="themeService.toggleTheme()">
                      {{ themeService.isDark() ? ('SETTINGS.THEME_LIGHT' | translate) : ('SETTINGS.THEME_DARK' | translate) }}
                    </button>
                  </div>

                  <div class="flex items-center justify-between mt-3">
                    <span class="text-xs">{{ 'SETTINGS.LANGUAGE' | translate }}</span>
                    <select
                      class="select select-bordered select-xs"
                      [ngModel]="languageService.currentLang()"
                      (ngModelChange)="languageService.setLanguage($event)"
                    >
                      @for (lang of languageService.supportedLanguages; track lang.code) {
                        <option [value]="lang.code">{{ lang.nativeName }}</option>
                      }
                    </select>
                  </div>
                </section>
              </div>
            }
            @case ('ai') {
              <app-ai-settings-dialog [embedded]="true" />
            }
          }
        </div>
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CLOSE' | translate }}</button>
      </div>
    </div>
  `,
  styles: [`
    .settings-dialog {
      width: 600px;
      max-width: 90vw;
      height: 500px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .settings-sidebar {
      @apply w-40 flex-shrink-0 border-r border-base-300 p-2 space-y-1 overflow-y-auto;
    }

    .sidebar-item {
      @apply flex items-center gap-2 w-full px-3 py-2 rounded text-xs text-base-content/70
             hover:bg-base-200 hover:text-base-content transition-colors cursor-pointer text-left;
    }

    .sidebar-item.active {
      @apply bg-primary/10 text-primary font-semibold;
    }

    .settings-content {
      @apply flex-1 p-4 overflow-y-auto;
    }
  `],
})
export class SettingsDialogComponent {
  @Output() close = new EventEmitter<void>();

  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);

  readonly activeTab = signal<SettingsTab>('general');
}
