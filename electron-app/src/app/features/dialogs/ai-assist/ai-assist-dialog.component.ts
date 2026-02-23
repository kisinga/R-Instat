/**
 * AI Assist Dialog
 *
 * User types intent; request goes to selected AI provider; model returns dialog + params;
 * user reviews and opens the dialog with pre-filled state.
 */

import { Component, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AIConfigService, type AIProvider } from '../../../core/services/ai-config.service';
import { AIClientService, type DataContext } from '../../../core/services/ai-client.service';
import { IntentResolverService, type ResolveResult, type ResolvedPlanStep } from '../../../core/services/intent-resolver.service';
import { DialogRestoreService } from '../../../core/services/dialog-restore.service';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { AIPlanQueueService } from '../../../core/services/ai-plan-queue.service';
import { AIEvalService } from '../../../core/services/ai-eval.service';

@Component({
  selector: 'app-ai-assist-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="dialog-content ai-assist-dialog" (click)="$event.stopPropagation()">
      <div class="dialog-header">
        <h2 class="text-lg font-semibold">{{ 'AI_ASSIST.TITLE' | translate }}</h2>
        <button class="btn btn-ghost btn-sm btn-square" (click)="close.emit()">✕</button>
      </div>

      <div class="dialog-body">
        <p class="text-sm text-base-content/70 mb-4">{{ 'AI_ASSIST.HINT' | translate }}</p>

        <div class="form-group">
          <textarea
            class="textarea textarea-bordered w-full min-h-24"
            [placeholder]="'AI_ASSIST.PLACEHOLDER' | translate"
            [ngModel]="userInput()"
            (ngModelChange)="onUserInputChange($event)"
            [disabled]="isLoading()"
          ></textarea>
        </div>

        <div class="form-group">
          <details class="collapse collapse-arrow bg-base-200 rounded-lg">
            <summary class="collapse-title py-2 min-h-0">{{ 'AI_ASSIST.SETTINGS' | translate }}</summary>
            <div class="collapse-content">
              <label class="form-label">{{ 'AI_ASSIST.PROVIDER' | translate }}</label>
              <select
                class="select select-bordered w-full select-sm"
                [ngModel]="selectedProvider()"
                (ngModelChange)="onProviderChange($event)"
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
                (ngModelChange)="apiKeyInput.set($event)"
              />
              <p class="text-xs text-base-content/60 mt-1">
                <a [href]="providerApiLink()" target="_blank" rel="noopener" class="link link-primary">
                  {{ (selectedProvider() === 'claude' ? 'AI_ASSIST.API_KEY_LINK_CLAUDE' : 'AI_ASSIST.API_KEY_LINK_OPENAI') | translate }}
                </a>
              </p>
              <button class="btn btn-sm btn-primary mt-2" (click)="saveApiKey()">
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
                  (ngModelChange)="updateHighThreshold($event)"
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
                  (ngModelChange)="updateLowThreshold($event)"
                />
              </div>

              <label class="label cursor-pointer justify-start gap-2 mt-2">
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary"
                  [ngModel]="gateSettings().requireConfirmationForInferred"
                  (ngModelChange)="updateRequireConfirmationForInferred($event)"
                />
                <span class="text-sm">{{ 'AI_ASSIST.REQUIRE_CONFIRM_INFERRED' | translate }}</span>
              </label>
            </div>
          </details>
        </div>

        @if (resolveResult(); as result) {
          @if (result.ok && result.plan) {
            <div class="alert alert-success mt-4">
              <div class="w-full">
                <p class="font-medium">{{ result.plan.goal }}</p>
                <p class="text-sm opacity-80 mt-1">
                  {{ 'AI_ASSIST.CONFIDENCE' | translate }}: {{ toPercent(result.plan.overallConfidence) }} ·
                  {{ 'AI_ASSIST.STEPS' | translate }}: {{ result.plan.steps.length }}
                </p>
                <p class="text-xs opacity-80 mt-1">
                  Mode: <span class="font-medium">{{ result.plan.executionMode }}</span>
                  · rationale: {{ result.plan.modeReason }}
                  · mode confidence: {{ toPercent(result.plan.modeConfidence) }}
                </p>
                @if (result.plan.assumptions.length) {
                  <p class="text-xs opacity-80 mt-2">
                    {{ 'AI_ASSIST.ASSUMPTIONS' | translate }}: {{ result.plan.assumptions.join(' | ') }}
                  </p>
                }
                @if (result.plan.clarificationQuestions.length) {
                  <div class="mt-2">
                    <p class="text-xs font-medium">{{ 'AI_ASSIST.QUESTIONS' | translate }}</p>
                    <ul class="text-xs list-disc list-inside">
                      @for (q of result.plan.clarificationQuestions; track q) {
                        <li>{{ q }}</li>
                      }
                    </ul>
                  </div>
                }
                @if (result.warnings?.length) {
                  <div class="alert alert-warning alert-soft mt-2">
                    <div class="text-xs">
                      <p class="font-medium mb-1">Auto-corrections / warnings</p>
                      <ul class="list-disc list-inside">
                        @for (w of result.warnings!; track w) {
                          <li>{{ w }}</li>
                        }
                      </ul>
                    </div>
                  </div>
                }
                <div class="mt-3 overflow-x-auto">
                  <table class="table table-xs">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Step</th>
                        <th>{{ 'AI_ASSIST.CONFIDENCE' | translate }}</th>
                        <th>{{ 'AI_ASSIST.INFERRED' | translate }}</th>
                        <th>{{ 'AI_ASSIST.CONFIRMED' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of result.plan.steps; track s.step.stepId; let i = $index) {
                        <tr>
                          <td>{{ i + 1 }}</td>
                          <td>{{ stepLabel(s) }}</td>
                          <td>{{ toPercent(s.step.confidence) }}</td>
                          <td>{{ s.step.inferredFields.join(', ') || '-' }}</td>
                          <td>
                            <input
                              type="checkbox"
                              class="checkbox checkbox-xs"
                              [checked]="isStepConfirmed(s.step.stepId)"
                              (change)="toggleStepConfirmed(s.step.stepId, $any($event.target).checked)"
                            />
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (currentStep()) {
                  <p class="text-xs opacity-80 mt-2">
                    {{ 'AI_ASSIST.NEXT_STEP' | translate }}:
                    @if (currentStep()!.kind === 'dialog') {
                      {{ currentStep()!.step.dialogId }} · {{ summarizeState(currentStep()!.metadata!.state) }}
                    } @else {
                      R code · {{ summarizeCode(currentStep()!.code!.script) }}
                    }
                  </p>
                }
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <button class="btn btn-sm btn-primary" (click)="applyCurrentStep()" [disabled]="!canApplyCurrentStep()">
                {{ 'AI_ASSIST.OPEN_CURRENT_STEP' | translate }}
              </button>
              <button class="btn btn-sm btn-outline" (click)="advanceStep()" [disabled]="!hasNextStep()">
                {{ 'AI_ASSIST.NEXT' | translate }}
              </button>
              <button class="btn btn-sm btn-outline" (click)="applyAllConfirmed()" [disabled]="!hasAnyApprovableStep()">
                {{ 'AI_ASSIST.RUN_ALL_CONFIRMED' | translate }}
              </button>
              <button class="btn btn-sm btn-ghost" (click)="clearPlan()">
                {{ 'AI_ASSIST.CLEAR_PLAN' | translate }}
              </button>
            </div>
          } @else if (result.error) {
            <div class="alert alert-error mt-4">
              <div>
                <p class="font-medium">{{ result.error }}</p>
                @if (rawResponse()) {
                  <pre class="text-xs mt-2 overflow-x-auto max-h-24">{{ rawResponse() }}</pre>
                }
              </div>
            </div>
          }
        }

        @if (errorMessage()) {
          <div class="alert alert-error mt-4">
            <span>{{ errorMessage() }}</span>
          </div>
        }
      </div>

      <div class="dialog-footer">
        <div class="flex-1"></div>
        <button class="btn btn-ghost" (click)="close.emit()">{{ 'DIALOG.CANCEL' | translate }}</button>
        <button
          class="btn btn-primary"
          (click)="send()"
          [disabled]="!userInput().trim() || isLoading()"
        >
          @if (isLoading()) {
            <span class="loading loading-spinner loading-sm"></span>
          }
          {{ 'AI_ASSIST.SEND' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-assist-dialog { width: 520px; max-width: 90vw; }
  `],
})
export class AIAssistDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly aiConfig = inject(AIConfigService);
  private readonly aiClient = inject(AIClientService);
  private readonly intentResolver = inject(IntentResolverService);
  private readonly dialogRestore = inject(DialogRestoreService);
  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly planQueue = inject(AIPlanQueueService);
  private readonly aiEval = inject(AIEvalService);

  userInput = signal('');
  apiKeyInput = signal('');
  selectedProvider = signal<AIProvider>('openai');
  isLoading = signal(false);
  resolveResult = signal<ResolveResult | null>(null);
  errorMessage = signal('');
  rawResponse = signal<string | undefined>(undefined);
  confirmedStepIds = signal<string[]>([]);

  readonly gateSettings = this.aiConfig.gateSettings;

  ngOnInit(): void {
    const provider = this.aiConfig.provider();
    this.selectedProvider.set(provider);
    this.loadMaskedKeyForProvider(provider);
    if (this.planQueue.hasPlan()) {
      this.resolveResult.set({ ok: true, plan: this.planQueue.plan()! });
    }
  }

  saveApiKey(): void {
    const key = this.apiKeyInput().trim();
    if (key && key !== '••••••••••••') {
      this.aiConfig.setApiKey(key, this.selectedProvider());
      this.toastService.success('API key saved');
      this.loadMaskedKeyForProvider(this.selectedProvider());
    }
  }

  onProviderChange(value: string): void {
    const provider: AIProvider = value === 'claude' ? 'claude' : 'openai';
    this.selectedProvider.set(provider);
    this.aiConfig.setProvider(provider);
    this.loadMaskedKeyForProvider(provider);
    // Clear stale provider-specific errors/results when switching.
    this.errorMessage.set('');
    this.resolveResult.set(null);
    this.rawResponse.set(undefined);
  }

  providerApiLink(): string {
    return this.selectedProvider() === 'claude'
      ? 'https://console.anthropic.com/settings/keys'
      : 'https://platform.openai.com/api-keys';
  }

  private loadMaskedKeyForProvider(provider: AIProvider): void {
    this.apiKeyInput.set(this.aiConfig.hasApiKeyFor(provider) ? '••••••••••••' : '');
  }

  onUserInputChange(value: string): void {
    const previous = this.userInput();
    this.userInput.set(value);
    if (value === previous) return;
    this.clearCurrentRunState();
  }

  private async buildDataContext(): Promise<DataContext> {
    const dataframes = this.rService.dataframes();
    const active = this.rService.activeDataframe();
    const columnsByDataframe: Record<string, Array<{ name: string; type: string }>> = {};
    for (const df of dataframes) {
      try {
        const colInfo = await this.rService.getColumnInfo(df);
        columnsByDataframe[df] = colInfo.map((c) => ({ name: c.name, type: c.type }));
      } catch {
        columnsByDataframe[df] = [];
      }
    }

    const df = active && dataframes.includes(active) ? active : dataframes[0] ?? null;
    return { dataframes, activeDataframe: df, columnsByDataframe };
  }

  async send(): Promise<void> {
    const input = this.userInput().trim();
    if (!input) return;

    this.clearCurrentRunState();
    this.isLoading.set(true);

    try {
      const dataContext = await this.buildDataContext();
      const result = await this.aiClient.call(input, dataContext);
      if ((result.privacyReport?.redactedPatterns.length ?? 0) > 0) {
        this.toastService.warning(
          `Sensitive patterns were redacted before sending to AI: ${result.privacyReport!.redactedPatterns.join(', ')}`
        );
      }

      if (result.success && result.plan) {
        const resolved = this.intentResolver.resolve(result, dataContext);
        if (resolved.ok && resolved.plan) {
          this.planQueue.setPlan(resolved.plan);
          this.confirmedStepIds.set([]);
          this.aiEval.recordSuccess(result.plan, resolved.warnings?.length ?? 0);
        } else {
          this.aiEval.recordFailure('resolver_validation_failed');
        }
        this.resolveResult.set(resolved);
      } else {
        this.aiEval.recordFailure('provider_or_parse_failure');
        this.resolveResult.set({ ok: false, error: result.error });
        this.rawResponse.set(result.rawResponse);
      }
    } catch (err) {
      this.aiEval.recordFailure('runtime_exception');
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  async applyCurrentStep(): Promise<void> {
    const step = this.currentStep();
    if (!step) return;
    if (!this.canApplyStep(step)) return;
    this.planQueue.advance();
    if (step.kind === 'dialog' && step.metadata) {
      this.openDialog(step);
      return;
    }
    if (step.kind === 'code' && step.code) {
      await this.executeCodeStep(step);
    }
  }

  async applyAllConfirmed(): Promise<void> {
    const plan = this.resolveResult()?.plan;
    if (!plan) return;
    const idx = plan.steps.findIndex((s) => this.canApplyStep(s));
    if (idx < 0) return;
    this.planQueue.setIndex(idx);
    const step = this.currentStep();
    if (!step) return;
    this.planQueue.advance();
    if (step.kind === 'dialog' && step.metadata) {
      this.openDialog(step);
      return;
    }
    if (step.kind === 'code' && step.code) {
      await this.executeCodeStep(step);
    }
  }

  openDialog(step: ResolvedPlanStep): void {
    if (!step.metadata) return;
    this.dialogRestore.setRestoreData({
      dialogId: step.metadata.dialogId,
      componentType: step.metadata.componentType,
      version: '1.0',
      state: step.metadata.state,
      timestamp: new Date().toISOString(),
    });
    const targetDialogId = step.metadata.dialogId;
    // Close AI Assist first, then open target dialog on next tick.
    // Otherwise, the close event can immediately clear the newly opened dialog.
    this.close.emit();
    queueMicrotask(() => this.rService.openDialog(targetDialogId));
    this.toastService.success(`Opening ${step.metadata.dialogId}...`);
  }

  private async executeCodeStep(step: ResolvedPlanStep): Promise<void> {
    if (!step.code) return;
    const result = await this.rService.execute(step.code.script);
    if (result.success) {
      this.toastService.success('Code step executed successfully.');
    } else {
      this.toastService.error(result.error ?? 'Code step failed.');
    }
  }

  advanceStep(): void {
    this.planQueue.advance();
    if (this.planQueue.plan()) {
      this.resolveResult.update((r) => (r?.ok ? { ...r, plan: this.planQueue.plan()! } : r));
    }
  }

  clearPlan(): void {
    this.clearCurrentRunState();
  }

  private clearCurrentRunState(): void {
    this.planQueue.clear();
    this.resolveResult.set(null);
    this.errorMessage.set('');
    this.rawResponse.set(undefined);
    this.confirmedStepIds.set([]);
  }

  currentStep(): ResolvedPlanStep | null {
    return this.planQueue.currentStep();
  }

  hasNextStep(): boolean {
    return this.planQueue.hasNext();
  }

  toggleStepConfirmed(stepId: string, checked: boolean): void {
    this.confirmedStepIds.update((current) => {
      const set = new Set(current);
      if (checked) set.add(stepId);
      else set.delete(stepId);
      return Array.from(set);
    });
  }

  isStepConfirmed(stepId: string): boolean {
    return this.confirmedStepIds().includes(stepId);
  }

  private requiresManualConfirmation(step: ResolvedPlanStep): boolean {
    const settings = this.gateSettings();
    if (step.step.confidence < settings.highConfidenceThreshold) {
      return true;
    }
    if (settings.requireConfirmationForInferred && step.step.inferredFields.length > 0) {
      return true;
    }
    return false;
  }

  canApplyStep(step: ResolvedPlanStep): boolean {
    const plan = this.resolveResult()?.plan;
    if (!plan) return false;
    // If clarifications are still open, require explicit per-step confirmation before execution.
    if (plan.clarificationQuestions.length > 0) {
      return this.isStepConfirmed(step.step.stepId);
    }
    const settings = this.gateSettings();
    if (this.requiresManualConfirmation(step)) {
      return this.isStepConfirmed(step.step.stepId);
    }
    return true;
  }

  canApplyCurrentStep(): boolean {
    const step = this.currentStep();
    if (!step) return false;
    return this.canApplyStep(step);
  }

  hasAnyApprovableStep(): boolean {
    const plan = this.resolveResult()?.plan;
    if (!plan) return false;
    return plan.steps.some((s) => this.canApplyStep(s));
  }

  updateHighThreshold(value: number): void {
    this.aiConfig.updateGateSettings({ highConfidenceThreshold: Number(value) });
  }

  updateLowThreshold(value: number): void {
    this.aiConfig.updateGateSettings({ lowConfidenceThreshold: Number(value) });
  }

  updateRequireConfirmationForInferred(value: boolean): void {
    this.aiConfig.updateGateSettings({ requireConfirmationForInferred: !!value });
  }

  toPercent(value: number): string {
    if (!Number.isFinite(value)) return '0%';
    return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  }

  summarizeState(state: Record<string, unknown>): string {
    const parts = Object.entries(state)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
        return `${k}: ${v}`;
      });
    return parts.slice(0, 6).join('; ') + (parts.length > 6 ? '...' : '');
  }

  summarizeCode(script: string): string {
    return script.replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  stepLabel(step: ResolvedPlanStep): string {
    if (step.kind === 'dialog' && step.metadata) {
      return step.metadata.dialogId;
    }
    return 'R code step';
  }
}
