/**
 * AI Assist settings panel: provider, API key, confidence thresholds, confirmation checkbox.
 */

import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import type { ConfidenceGateSettings } from '../../../core/services/ai-config.service';
import { toPercent } from './ai-assist-formatters';

@Component({
  selector: 'app-ai-assist-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="form-group">
      <details class="collapse collapse-arrow bg-base-200 rounded-lg">
        <summary class="collapse-title py-2 min-h-0">{{ 'AI_ASSIST.SETTINGS' | translate }}</summary>
        <div class="collapse-content">
          <label class="form-label">{{ 'AI_ASSIST.PROVIDER' | translate }}</label>
          <select
            class="select select-bordered w-full select-sm"
            [ngModel]="selectedProvider()"
            (ngModelChange)="providerChange.emit($event)"
          >
            <option value="openai">{{ 'AI_ASSIST.PROVIDER_OPENAI' | translate }}</option>
            <option value="claude">{{ 'AI_ASSIST.PROVIDER_CLAUDE' | translate }}</option>
          </select>

          <label class="form-label">{{ 'AI_ASSIST.API_KEY' | translate }}</label>
          <input
            type="password"
            class="input input-bordered w-full input-sm"
            [placeholder]="(selectedProvider() === 'claude' ? 'AI_ASSIST.API_KEY_PLACEHOLDER_CLAUDE' : 'AI_ASSIST.API_KEY_PLACEHOLDER_OPENAI') | translate"
            [ngModel]="apiKeyInput()"
            (ngModelChange)="apiKeyInputChange.emit($event)"
          />
          <p class="text-xs text-base-content/60 mt-1">
            <a [href]="providerApiLink()" target="_blank" rel="noopener" class="link link-primary">
              {{ (selectedProvider() === 'claude' ? 'AI_ASSIST.API_KEY_LINK_CLAUDE' : 'AI_ASSIST.API_KEY_LINK_OPENAI') | translate }}
            </a>
          </p>
          <button class="btn btn-sm btn-primary mt-2" (click)="saveApiKey.emit()">
            {{ 'AI_ASSIST.SAVE_KEY' | translate }}
          </button>

          <div class="mt-4">
            <label class="form-label">{{ 'AI_ASSIST.HIGH_THRESHOLD' | translate }}: {{ toPercent(gateSettings().highConfidenceThreshold) }}</label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.01"
              class="range range-primary range-sm"
              [ngModel]="gateSettings().highConfidenceThreshold"
              (ngModelChange)="highThresholdChange.emit($event)"
            />
          </div>

          <div class="mt-3">
            <label class="form-label">{{ 'AI_ASSIST.LOW_THRESHOLD' | translate }}: {{ toPercent(gateSettings().lowConfidenceThreshold) }}</label>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.01"
              class="range range-secondary range-sm"
              [ngModel]="gateSettings().lowConfidenceThreshold"
              (ngModelChange)="lowThresholdChange.emit($event)"
            />
          </div>

          <label class="label cursor-pointer justify-start gap-2 mt-2">
            <input
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary"
              [ngModel]="gateSettings().requireConfirmationForInferred"
              (ngModelChange)="requireConfirmationChange.emit($event)"
            />
            <span class="text-sm">{{ 'AI_ASSIST.REQUIRE_CONFIRM_INFERRED' | translate }}</span>
          </label>
        </div>
      </details>
    </div>
  `,
})
export class AiAssistSettingsComponent {
  readonly selectedProvider = input.required<string>();
  readonly apiKeyInput = input.required<string>();
  readonly gateSettings = input.required<ConfidenceGateSettings>();
  readonly providerApiLink = input.required<string>();

  readonly providerChange = output<string>();
  readonly apiKeyInputChange = output<string>();
  readonly saveApiKey = output<void>();
  readonly highThresholdChange = output<number>();
  readonly lowThresholdChange = output<number>();
  readonly requireConfirmationChange = output<boolean>();

  protected readonly toPercent = toPercent;
}
