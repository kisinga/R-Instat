import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/**
 * Theme Service - Manages application theme
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'r-instat-theme';
  
  private readonly _theme = signal<Theme>('dark');
  readonly theme = this._theme.asReadonly();

  /**
   * Initialize theme from storage or system preference
   */
  initTheme(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    
    if (stored && (stored === 'dark' || stored === 'light')) {
      this.setTheme(stored);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  /**
   * Set theme and persist to storage
   */
  setTheme(theme: Theme): void {
    this._theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(this.STORAGE_KEY, theme);
  }

  /**
   * Toggle between dark and light themes
   */
  toggleTheme(): void {
    const current = this._theme();
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }

  /**
   * Check if current theme is dark
   */
  isDark(): boolean {
    return this._theme() === 'dark';
  }
}
