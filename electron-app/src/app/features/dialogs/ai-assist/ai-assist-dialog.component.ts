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
import { AIClientService } from '../../../core/services/ai-client.service';
import type { AICallResult, DataContext } from '../../../core/ai/types';
import { IntentResolverService, type ResolveResult, type ResolvedPlanStep } from '../../../core/services/intent-resolver.service';
import { DialogRestoreService } from '../../../core/services/dialog-restore.service';
import { RService } from '../../../core/services/r.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { AIPlanQueueService } from '../../../core/services/ai-plan-queue.service';
import { AIEvalService } from '../../../core/services/ai-eval.service';
import { EducationStoreService } from '../../../core/services/education-store.service';
import { EducationPipeline } from '../../../core/ai/pipeline/education-pipeline';
import { enrichHighlights } from '../../../core/ai/highlight-enricher';
import { DialogMenuResolver, STANDARD_MENU_GROUPS } from '../../../core/ai/dialog-menu-resolver';
import { LanguageService } from '../../../core/services/language.service';
import { ruleBasedCategorizer } from '../../../core/ai/categorizer-rules';
import { AiAssistSettingsComponent } from './ai-assist-settings.component';
import { AiAssistPlanResultComponent } from './ai-assist-plan-result.component';
import { AiAssistDisambiguationComponent } from './ai-assist-disambiguation.component';
import { AiAssistErrorCardComponent } from './ai-assist-error-card.component';
import { AiAssistYouSentComponent } from './ai-assist-you-sent.component';
import { HydrationService } from '../../../core/vector/hydration.service';

@Component({
  selector: 'app-ai-assist-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    AiAssistSettingsComponent,
    AiAssistPlanResultComponent,
    AiAssistDisambiguationComponent,
    AiAssistErrorCardComponent,
    AiAssistYouSentComponent,
  ],
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

        <app-ai-assist-settings
          [selectedProvider]="selectedProvider()"
          [apiKeyInput]="apiKeyInput()"
          [gateSettings]="gateSettings()"
          [providerApiLink]="providerApiLink()"
          (providerChange)="onProviderChange($event)"
          (apiKeyInputChange)="apiKeyInput.set($event)"
          (saveApiKey)="saveApiKey()"
          (highThresholdChange)="updateHighThreshold($event)"
          (lowThresholdChange)="updateLowThreshold($event)"
          (requireConfirmationChange)="updateRequireConfirmationForInferred($event)"
        />

        @if (lastSentMessage(); as message) {
          <app-ai-assist-you-sent [message]="message" />
        }

        @if (resolveResult(); as result) {
          @if (result.ok && result.plan) {
            <app-ai-assist-plan-result
              [result]="result"
              [responseReceivedAt]="responseReceivedAt()"
              [currentStep]="currentStep()"
              [isLoading]="isLoading()"
              [confirmedStepIds]="confirmedStepIds()"
              [canApplyCurrentStep]="canApplyCurrentStep()"
              [hasNextStep]="hasNextStep()"
              [hasAnyApprovableStep]="hasAnyApprovableStep()"
              (sendClarificationOption)="sendClarificationOption($event)"
              (toggleStepConfirmed)="toggleStepConfirmed($event.stepId, $event.checked)"
              (applyCurrentStep)="applyCurrentStep()"
              (advanceStep)="advanceStep()"
              (applyAllConfirmed)="applyAllConfirmed()"
              (clearPlan)="clearPlan()"
            />
          } @else if (result.needsDisambiguation && result.disambiguationSuggestions?.length) {
            <app-ai-assist-disambiguation
              [suggestions]="result.disambiguationSuggestions ?? []"
              [isLoading]="isLoading()"
              (sendClarification)="sendClarificationOption($event)"
            />
          } @else if (result.error) {
            <app-ai-assist-error-card
              [error]="result.error"
              [rawResponse]="rawResponse()"
            />
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
  styles: [`.ai-assist-dialog { width: 520px; max-width: 90vw; }`],
})
export class AIAssistDialogComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private readonly aiConfig = inject(AIConfigService);
  private readonly aiClient = inject(AIClientService);
  private readonly intentResolver = inject(IntentResolverService);
  private readonly dialogRestore = inject(DialogRestoreService);
  private readonly rService = inject(RService);
  private readonly toastService = inject(ToastService);
  private readonly appState = inject(AppStateService);
  private readonly planQueue = inject(AIPlanQueueService);
  private readonly aiEval = inject(AIEvalService);
  private readonly educationStore = inject(EducationStoreService);
  private readonly educationPipeline = inject(EducationPipeline);
  private readonly languageService = inject(LanguageService);
  private readonly hydrationService = inject(HydrationService);

  userInput = signal('');
  apiKeyInput = signal('');
  selectedProvider = signal<AIProvider>('openai');
  isLoading = signal(false);
  resolveResult = signal<ResolveResult | null>(null);
  /** Last user message sent (typed or clicked clarification) so the UI shows conversation progress */
  lastSentMessage = signal<string | null>(null);
  /** When the current result was received (so user sees that a new response arrived) */
  responseReceivedAt = signal<number | null>(null);
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

    // Hydrate vector indexes if configured for on-ai-panel
    this.hydrationService.hydrateIfNeeded('on-ai-panel');
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

  /**
   * Send a clarification option as the next user message to continue the conversation.
   */
  async sendClarificationOption(optionText: string): Promise<void> {
    this.userInput.set(optionText);
    await this.send();
    this.userInput.set('');
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

  /** Reset all UI and plan state before sending a new message. */
  private resetStateForSend(): void {
    this.planQueue.clear();
    this.resolveResult.set(null);
    this.errorMessage.set('');
    this.rawResponse.set(undefined);
    this.confirmedStepIds.set([]);
  }

  private warnIfPrivacyRedacted(result: AICallResult): void {
    const count = result.privacyReport?.redactedPatterns?.length ?? 0;
    if (count === 0) return;
    this.toastService.warning(
      `Sensitive patterns were redacted before sending to AI: ${result.privacyReport!.redactedPatterns.join(', ')}`
    );
  }

  private handlePlanSuccess(result: AICallResult, dataContext: DataContext): void {
    const resolved = this.intentResolver.resolve(result, dataContext);
    if (resolved.ok && resolved.plan) {
      this.planQueue.setPlan(resolved.plan);
      this.confirmedStepIds.set([]);
      this.aiEval.recordSuccess(result.plan!, resolved.warnings?.length ?? 0);
    } else {
      this.aiEval.recordFailure('resolver_validation_failed');
    }
    this.resolveResult.set(null);
    this.responseReceivedAt.set(Date.now());
    queueMicrotask(() => this.resolveResult.set(resolved));
  }

  private handleDisambiguation(result: AICallResult): void {
    this.resolveResult.set({
      ok: false,
      needsDisambiguation: true,
      disambiguationSuggestions: result.disambiguationSuggestions!,
    });
    this.responseReceivedAt.set(Date.now());
  }

  private handleProviderOrParseFailure(result: AICallResult): void {
    this.aiEval.recordFailure('provider_or_parse_failure');
    this.resolveResult.set({ ok: false, error: result.error });
    this.rawResponse.set(result.rawResponse);
  }

  async send(): Promise<void> {
    const input = this.userInput().trim();
    if (!input) return;

    // Check if this is an education question — redirect to Learn tab
    const ruleResult = ruleBasedCategorizer(input, false);
    if (ruleResult?.category === 'education_question') {
      await this.redirectToEducation(input);
      return;
    }

    this.lastSentMessage.set(input);
    this.resetStateForSend();
    this.isLoading.set(true);

    try {
      const dataContext = await this.buildDataContext();
      const result = await this.aiClient.call(input, dataContext);

      this.warnIfPrivacyRedacted(result);

      if (result.success && result.plan) {
        this.handlePlanSuccess(result, dataContext);
      } else if (result.needsDisambiguation && (result.disambiguationSuggestions?.length ?? 0) > 0) {
        this.handleDisambiguation(result);
      } else {
        this.handleProviderOrParseFailure(result);
      }
    } catch (err) {
      this.aiEval.recordFailure('runtime_exception');
      this.errorMessage.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Redirect an education question to the Learn tab.
   * Appends the user message, fires the pipeline, switches tab, and closes the modal.
   */
  private async redirectToEducation(input: string): Promise<void> {
    this.educationStore.appendUserMessage(input);
    this.appState.emitPanelEvent('output', 'show-education');
    this.close.emit();

    // Fire education pipeline in background (response will appear in Learn tab)
    try {
      const dataContext = await this.buildDataContext();
      const history = this.educationStore.activeConversation()?.messages
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content })) ?? [];

      const result = await this.educationPipeline.execute(input, dataContext, history);

      if (result.success && result.response) {
        const menuResolver = new DialogMenuResolver(
          STANDARD_MENU_GROUPS,
          (key: string) => this.languageService.instant(key)
        );
        const highlights = enrichHighlights(result.response.highlights, menuResolver);
        this.educationStore.appendAssistantMessage(
          result.response.explanation,
          highlights,
          result.response.followUpSuggestions
        );
      }
    } catch {
      // Errors will be visible in the Learn tab on next interaction
    }
  }

  /**
   * Advance the queue and run the given step (open dialog or execute code).
   * Caller must ensure the step is applicable (canApplyStep).
   */
  private async executeStep(step: ResolvedPlanStep): Promise<void> {
    this.planQueue.advance();
    if (step.kind === 'dialog' && step.metadata) {
      this.openDialog(step);
      return;
    }
    if (step.kind === 'code' && step.code) {
      await this.executeCodeStep(step);
    }
  }

  async applyCurrentStep(): Promise<void> {
    const step = this.currentStep();
    if (!step || !this.canApplyStep(step)) return;
    await this.executeStep(step);
  }

  async applyAllConfirmed(): Promise<void> {
    const plan = this.resolveResult()?.plan;
    if (!plan) return;
    const idx = plan.steps.findIndex((s) => this.canApplyStep(s));
    if (idx < 0) return;
    this.planQueue.setIndex(idx);
    const step = this.currentStep();
    if (!step) return;
    await this.executeStep(step);
  }

  openDialog(step: ResolvedPlanStep): void {
    if (!step.metadata) return;
    this.dialogRestore.setRestoreData({
      dialogId: step.metadata.dialogId,
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
    this.lastSentMessage.set(null);
    this.responseReceivedAt.set(null);
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
    if (plan.clarifications.length > 0) {
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
}
