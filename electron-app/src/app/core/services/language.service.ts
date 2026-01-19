import { Injectable, inject, signal, computed } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

/**
 * Language Service - Manages application language/locale
 * 
 * Follows the same pattern as ThemeService for consistency.
 * Persists language preference to localStorage and integrates with ngx-translate.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly STORAGE_KEY = 'r-instat-language';
  private readonly translateService = inject(TranslateService);
  
  private readonly _currentLang = signal<string>('en');
  readonly currentLang = this._currentLang.asReadonly();

  /**
   * List of supported languages
   * Add new languages here when expanding i18n support
   */
  readonly supportedLanguages: SupportedLanguage[] = [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'fr', name: 'French', nativeName: 'Français' }
  ];

  /**
   * Get the current language display name (native name)
   */
  readonly currentLangName = computed(() => {
    const lang = this.supportedLanguages.find(l => l.code === this._currentLang());
    return lang?.nativeName || 'English';
  });

  /**
   * Get the current language object
   */
  readonly currentLanguage = computed(() => {
    return this.supportedLanguages.find(l => l.code === this._currentLang()) || this.supportedLanguages[0];
  });

  /**
   * Initialize language from storage or browser preference
   * Should be called once during app initialization
   */
  initLanguage(): void {
    // Set supported languages for ngx-translate
    this.translateService.addLangs(this.supportedLanguages.map(l => l.code));
    this.translateService.setDefaultLang('en');

    const stored = localStorage.getItem(this.STORAGE_KEY);
    
    if (stored && this.isSupported(stored)) {
      this.setLanguage(stored);
    } else {
      // Try to detect browser language
      const browserLang = this.getBrowserLanguage();
      if (browserLang && this.isSupported(browserLang)) {
        this.setLanguage(browserLang);
      } else {
        // Default to English
        this.setLanguage('en');
      }
    }
  }

  /**
   * Set the active language and persist to storage
   */
  setLanguage(langCode: string): void {
    if (!this.isSupported(langCode)) {
      console.warn(`Language '${langCode}' is not supported. Falling back to 'en'.`);
      langCode = 'en';
    }

    this._currentLang.set(langCode);
    this.translateService.use(langCode);
    localStorage.setItem(this.STORAGE_KEY, langCode);
    
    // Update document lang attribute for accessibility
    document.documentElement.setAttribute('lang', langCode);

    // Notify Electron main process to update native menu
    if (window.electronAPI?.app?.setLanguage) {
      window.electronAPI.app.setLanguage(langCode).catch(err => {
        console.warn('Failed to update Electron menu language:', err);
      });
    }
  }

  /**
   * Check if a language code is supported
   */
  isSupported(langCode: string): boolean {
    return this.supportedLanguages.some(lang => lang.code === langCode);
  }

  /**
   * Get instant translation (synchronous)
   * Use for TypeScript code where you need immediate translation
   */
  instant(key: string, params?: Record<string, unknown>): string {
    return this.translateService.instant(key, params);
  }

  /**
   * Get translation as Observable (async)
   * Use when you need to react to language changes
   */
  get(key: string, params?: Record<string, unknown>) {
    return this.translateService.get(key, params);
  }

  /**
   * Detect browser language preference
   */
  private getBrowserLanguage(): string | null {
    const browserLang = navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage;
    if (browserLang) {
      // Extract language code (e.g., 'en-US' -> 'en')
      return browserLang.split('-')[0].toLowerCase();
    }
    return null;
  }
}
