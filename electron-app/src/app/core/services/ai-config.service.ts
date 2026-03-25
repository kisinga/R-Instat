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
const RETRIEVAL_STORAGE_KEY = 'r-instat-ai-retrieval-settings';
const HYDRATION_STORAGE_KEY = 'r-instat-ai-hydration-mode';

export type AIProvider = 'openai' | 'claude';

/**
 * Controls when vector indexes (dialog contracts, R signatures) are refreshed.
 * - 'on-launch':    Refresh all indexes at app startup (default)
 * - 'on-ai-panel':  Refresh when the AI assist panel is first opened
 * - 'disabled':     Never auto-refresh; manual only
 */
export type HydrationMode = 'on-launch' | 'on-ai-panel' | 'disabled';

export interface ConfidenceGateSettings {
  highConfidenceThreshold: number;
  lowConfidenceThreshold: number;
  requireConfirmationForInferred: boolean;
}

export interface RetrievalSettings {
  useDialogContractRetrieval: boolean;
  topKContracts: number;
}

export interface LLMModelConfig {
  plannerModel: string;
  plannerTemperature: number;
  plannerMaxTokens: number;
  categorizerModel: string;
  categorizerTemperature: number;
  categorizerMaxTokens: number;
  codegenModel: string;
  codegenTemperature: number;
  codegenMaxTokens: number;
}

const DEFAULT_MODEL_CONFIG: Record<AIProvider, LLMModelConfig> = {
  claude: {
    plannerModel: 'claude-haiku-4-5',
    plannerTemperature: 0.2,
    plannerMaxTokens: 1800,
    categorizerModel: 'claude-haiku-4-5',
    categorizerTemperature: 0.1,
    categorizerMaxTokens: 120,
    codegenModel: 'claude-haiku-4-5',
    codegenTemperature: 0.1,
    codegenMaxTokens: 2048,
  },
  openai: {
    plannerModel: 'gpt-4o-mini',
    plannerTemperature: 0.2,
    plannerMaxTokens: 2048,
    categorizerModel: 'gpt-4o-mini',
    categorizerTemperature: 0.1,
    categorizerMaxTokens: 120,
    codegenModel: 'gpt-4o-mini',
    codegenTemperature: 0.1,
    codegenMaxTokens: 2048,
  },
};

const DEFAULT_GATE_SETTINGS: ConfidenceGateSettings = {
  highConfidenceThreshold: 0.8,
  lowConfidenceThreshold: 0.55,
  requireConfirmationForInferred: true,
};

const DEFAULT_RETRIEVAL_SETTINGS: RetrievalSettings = {
  useDialogContractRetrieval: false,
  topKContracts: 8,
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
  private readonly _retrievalSettings = signal<RetrievalSettings>({ ...DEFAULT_RETRIEVAL_SETTINGS });
  readonly retrievalSettings = this._retrievalSettings.asReadonly();

  private readonly _hydrationMode = signal<HydrationMode>('on-launch');
  readonly hydrationMode = this._hydrationMode.asReadonly();

  readonly modelConfig = computed<LLMModelConfig>(() => DEFAULT_MODEL_CONFIG[this._provider()]);
  readonly verboseAiDiagnostics = signal(false);
  readonly piiRedactionEnabled = signal(true);

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

    const storedRetrieval = localStorage.getItem(RETRIEVAL_STORAGE_KEY);
    if (storedRetrieval) {
      try {
        const parsed = JSON.parse(storedRetrieval) as Partial<RetrievalSettings>;
        this._retrievalSettings.set({
          useDialogContractRetrieval:
            typeof parsed.useDialogContractRetrieval === 'boolean'
              ? parsed.useDialogContractRetrieval
              : DEFAULT_RETRIEVAL_SETTINGS.useDialogContractRetrieval,
          topKContracts:
            typeof parsed.topKContracts === 'number'
              ? Math.max(1, Math.min(25, Math.round(parsed.topKContracts)))
              : DEFAULT_RETRIEVAL_SETTINGS.topKContracts,
        });
      } catch {
        this._retrievalSettings.set({ ...DEFAULT_RETRIEVAL_SETTINGS });
      }
    }

    const storedHydration = localStorage.getItem(HYDRATION_STORAGE_KEY);
    if (storedHydration === 'on-launch' || storedHydration === 'on-ai-panel' || storedHydration === 'disabled') {
      this._hydrationMode.set(storedHydration);
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

  setHydrationMode(mode: HydrationMode): void {
    this._hydrationMode.set(mode);
    localStorage.setItem(HYDRATION_STORAGE_KEY, mode);
  }

  updateRetrievalSettings(updates: Partial<RetrievalSettings>): void {
    this._retrievalSettings.update((current) => {
      const next = {
        ...current,
        ...updates,
      };
      next.topKContracts = Math.max(1, Math.min(25, Math.round(next.topKContracts)));
      localStorage.setItem(RETRIEVAL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }
}
