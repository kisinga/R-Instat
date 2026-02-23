/**
 * AI Config Service
 *
 * Manages AI provider + API key storage for AI Assist. Persists to localStorage.
 * Never logs the key; use hasApiKey for checks.
 */

import { Injectable, signal, computed } from '@angular/core';

const LEGACY_STORAGE_KEY = 'r-instat-ai-api-key';
const OPENAI_STORAGE_KEY = 'r-instat-ai-openai-api-key';
const CLAUDE_STORAGE_KEY = 'r-instat-ai-claude-api-key';
const PROVIDER_STORAGE_KEY = 'r-instat-ai-provider';
const GATE_STORAGE_KEY = 'r-instat-ai-gate-settings';

export type AIProvider = 'openai' | 'claude';

export interface ConfidenceGateSettings {
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  requireConfirmationForInferred: boolean;
}

const DEFAULT_GATE_SETTINGS: ConfidenceGateSettings = {
  highConfidenceThreshold: 0.8,
  lowConfidenceThreshold: 0.55,
  requireConfirmationForInferred: true,
};

@Injectable({ providedIn: 'root' })
export class AIConfigService {
  private readonly _provider = signal<AIProvider>('claude');
  readonly provider = this._provider.asReadonly();

  private readonly _openaiApiKey = signal<string>('');
  private readonly _claudeApiKey = signal<string>('');

  readonly apiKey = computed(() =>
    this._provider() === 'claude' ? this._claudeApiKey() : this._openaiApiKey()
  );
  readonly hasApiKey = computed(() => !!this.apiKey().trim());
  private readonly _gateSettings = signal<ConfidenceGateSettings>({ ...DEFAULT_GATE_SETTINGS });
  readonly gateSettings = this._gateSettings.asReadonly();

  constructor() {
    const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (storedProvider === 'openai' || storedProvider === 'claude') {
      this._provider.set(storedProvider);
    }

    const openAiStored = localStorage.getItem(OPENAI_STORAGE_KEY);
    if (openAiStored) {
      this._openaiApiKey.set(openAiStored);
    } else {
      // Migrate legacy single-key storage to OpenAI.
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored) {
        this._openaiApiKey.set(legacyStored);
        localStorage.setItem(OPENAI_STORAGE_KEY, legacyStored);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }

    const claudeStored = localStorage.getItem(CLAUDE_STORAGE_KEY);
    if (claudeStored) {
      this._claudeApiKey.set(claudeStored);
    }

    const storedGate = localStorage.getItem(GATE_STORAGE_KEY);
    if (storedGate) {
      try {
        const parsed = JSON.parse(storedGate) as Partial<ConfidenceGateSettings>;
        this._gateSettings.set({
          highConfidenceThreshold:
            typeof parsed.highConfidenceThreshold === 'number'
              ? parsed.highConfidenceThreshold
              : DEFAULT_GATE_SETTINGS.highConfidenceThreshold,
          lowConfidenceThreshold:
            typeof parsed.lowConfidenceThreshold === 'number'
              ? parsed.lowConfidenceThreshold
              : DEFAULT_GATE_SETTINGS.lowConfidenceThreshold,
          requireConfirmationForInferred:
            typeof parsed.requireConfirmationForInferred === 'boolean'
              ? parsed.requireConfirmationForInferred
              : DEFAULT_GATE_SETTINGS.requireConfirmationForInferred,
        });
      } catch {
        this._gateSettings.set({ ...DEFAULT_GATE_SETTINGS });
      }
    }
  }

  setProvider(provider: AIProvider): void {
    this._provider.set(provider);
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  }

  setApiKey(key: string, provider: AIProvider = this._provider()): void {
    const trimmed = key.trim();
    if (provider === 'claude') {
      this._claudeApiKey.set(trimmed);
      if (trimmed) {
        localStorage.setItem(CLAUDE_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(CLAUDE_STORAGE_KEY);
      }
      return;
    }

    this._openaiApiKey.set(trimmed);
    if (trimmed) {
      localStorage.setItem(OPENAI_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(OPENAI_STORAGE_KEY);
    }
  }

  clearApiKey(provider: AIProvider = this._provider()): void {
    if (provider === 'claude') {
      this._claudeApiKey.set('');
      localStorage.removeItem(CLAUDE_STORAGE_KEY);
      return;
    }
    this._openaiApiKey.set('');
    localStorage.removeItem(OPENAI_STORAGE_KEY);
  }

  apiKeyFor(provider: AIProvider): string {
    return provider === 'claude' ? this._claudeApiKey() : this._openaiApiKey();
  }

  hasApiKeyFor(provider: AIProvider): boolean {
    return !!this.apiKeyFor(provider).trim();
  }

  updateGateSettings(updates: Partial<ConfidenceGateSettings>): void {
    this._gateSettings.update((current) => {
      const next = {
        ...current,
        ...updates,
      };
      // Clamp thresholds to valid range and preserve ordering.
      next.highConfidenceThreshold = Math.max(0, Math.min(1, next.highConfidenceThreshold));
      next.lowConfidenceThreshold = Math.max(0, Math.min(1, next.lowConfidenceThreshold));
      if (next.lowConfidenceThreshold > next.highConfidenceThreshold) {
        next.lowConfidenceThreshold = next.highConfidenceThreshold;
      }
      localStorage.setItem(GATE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }
}
