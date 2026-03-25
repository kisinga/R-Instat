/**
 * AI Settings — can be used standalone as a dialog or embedded in a parent container.
 * Set [embedded]="true" to suppress the dialog chrome (header/footer).
 */

import { Component, Output, EventEmitter, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AIConfigService, type AIProvider } from '../../../core/services/ai-config.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-ai-settings-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <ng-template #settingsBody>
      <div class="space-y-6">
        <!-- AI Provider Section -->
        <section>
          <h3 class="text-sm font-semibold mb-2">{{ 'AI_SETTINGS.SECTION_PROVIDER' | translate }}</h3>

          <label class="form-label text-xs">{{ 'AI_SETTINGS.PROVIDER' | translate }}</label>
          <select
            class="select select-bordered w-full select-sm"
            [ngModel]="selectedProvider()"
            (ngModelChange)="onProviderChange($event)"
          >
            <option value="openai">OpenAI</option>
            <option value="claude">Claude</option>
          </select>

          <label class="form-label text-xs mt-2">{{ 'AI_SETTINGS.API_KEY' | translate }}</label>
          <div class="flex gap-2">
            <input
              type="password"
              class="input input-bordered input-sm flex-1"
              [placeholder]="selectedProvider() === 'claude' ? 'sk-ant-...' : 'sk-...'"
              [ngModel]="apiKeyInput()"
              (ngModelChange)="apiKeyInput.set($event)"
            />
            <button class="btn btn-sm btn-primary" (click)="saveApiKey()">
              {{ 'AI_SETTINGS.SAVE_KEY' | translate }}
            </button>
          </div>
          <p class="text-xs text-base-content/60 mt-1">
            <a [href]="providerApiLink()" target="_blank" rel="noopener" class="link link-primary">
              {{ 'AI_SETTINGS.GET_KEY' | translate }}
            </a>
          </p>
        </section>

        <!-- Confidence Thresholds -->
        <section>
          <h3 class="text-sm font-semibold mb-2">{{ 'AI_SETTINGS.SECTION_THRESHOLDS' | translate }}</h3>

          <label class="form-label text-xs">
            {{ 'AI_SETTINGS.HIGH_THRESHOLD' | translate }}: {{ toPercent(aiConfig.gateSettings().highConfidenceThreshold) }}
          </label>
          <input
            type="range" min="0.5" max="1" step="0.01"
            class="range range-primary range-sm"
            [ngModel]="aiConfig.gateSettings().highConfidenceThreshold"
            (ngModelChange)="aiConfig.updateGateSettings({ highConfidenceThreshold: $event })"
          />

          <label class="form-label text-xs mt-2">
            {{ 'AI_SETTINGS.LOW_THRESHOLD' | translate }}: {{ toPercent(aiConfig.gateSettings().lowConfidenceThreshold) }}
          </label>
          <input
            type="range" min="0" max="0.9" step="0.01"
            class="range range-secondary range-sm"
            [ngModel]="aiConfig.gateSettings().lowConfidenceThreshold"
            (ngModelChange)="aiConfig.updateGateSettings({ lowConfidenceThreshold: $event })"
          />

          <label class="label cursor-pointer justify-start gap-2 mt-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary"
              [ngModel]="aiConfig.gateSettings().requireConfirmationForInferred"
              (ngModelChange)="aiConfig.updateGateSettings({ requireConfirmationForInferred: $event })"
            />
            <span class="text-xs">{{ 'AI_SETTINGS.REQUIRE_CONFIRM' | translate }}</span>
          </label>
        </section>

        <!-- Advanced -->
        <section>
          <h3 class="text-sm font-semibold mb-2">{{ 'AI_SETTINGS.SECTION_ADVANCED' | translate }}</h3>

          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              [ngModel]="aiConfig.piiRedactionEnabled()"
              (ngModelChange)="aiConfig.piiRedactionEnabled.set($event)"
            />
            <span class="text-xs">{{ 'AI_SETTINGS.PII_REDACTION' | translate }}</span>
          </label>

          <label class="label cursor-pointer justify-start gap-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm"
              [ngModel]="aiConfig.verboseAiDiagnostics()"
              (ngModelChange)="aiConfig.verboseAiDiagnostics.set($event)"
            />
            <span class="text-xs">{{ 'AI_SETTINGS.VERBOSE_DIAGNOSTICS' | translate }}</span>
          </label>
        </section>
      </div>
    </ng-template>

    @if (embedded) {
      <ng-container *ngTemplateOutlet="settingsBody" />
    } @else {
      <div class="dialog-content ai-settings-dialog" (click)="$event.stopPropagation()">
        <div class="dialog-header">
          <h2 class="text-lg font-semibold">{{ 'AI_SETTINGS.TITLE' | translate }}</h2>
          <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
        </div>
        <div class="dialog-body max-h-[70vh] overflow-y-auto">
          <ng-container *ngTemplateOutlet="settingsBody" />
        </div>
        <div class="dialog-footer">
          <div class="flex-1"></div>
          <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CLOSE' | translate }}</button>
        </div>
      </div>
    }
  `,
  styles: [`.ai-settings-dialog { width: 420px; max-width: 90vw; }`],
})
export class AiSettingsDialogComponent implements OnInit {
  @Input() embedded = false;
  @Output() close = new EventEmitter<void>();

  readonly aiConfig = inject(AIConfigService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  private readonly toastService = inject(ToastService);

  readonly selectedProvider = signal<AIProvider>('claude');
  readonly apiKeyInput = signal('');

  ngOnInit(): void {
    this.selectedProvider.set(this.aiConfig.provider());
    this.loadMaskedKey(this.aiConfig.provider());
  }

  onProviderChange(value: string): void {
    const provider: AIProvider = value === 'claude' ? 'claude' : 'openai';
    this.selectedProvider.set(provider);
    this.aiConfig.setProvider(provider);
    this.loadMaskedKey(provider);
  }

  saveApiKey(): void {
    const key = this.apiKeyInput().trim();
    if (key && key !== '••••••••••••') {
      this.aiConfig.setApiKey(key, this.selectedProvider());
      this.toastService.success('API key saved');
      this.loadMaskedKey(this.selectedProvider());
    }
  }

  providerApiLink(): string {
    return this.selectedProvider() === 'claude'
      ? 'https://console.anthropic.com/settings/keys'
      : 'https://platform.openai.com/api-keys';
  }

  toPercent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private loadMaskedKey(provider: AIProvider): void {
    this.apiKeyInput.set(this.aiConfig.hasApiKeyFor(provider) ? '••••••••••••' : '');
  }
}
