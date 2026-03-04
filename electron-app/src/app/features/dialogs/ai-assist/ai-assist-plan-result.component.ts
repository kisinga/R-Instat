/**
 * AI Assist plan result card: goal, mode/assumptions, clarification questions,
 * warnings, steps table, next-step preview, and action buttons.
 */

import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import type { ResolveResult, ResolvedPlanStep } from '../../../core/services/intent-resolver.service';
import { toPercent, stepLabel, summarizeState, summarizeCode } from './ai-assist-formatters';

@Component({
  selector: 'app-ai-assist-plan-result',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  template: `
    <div class="ai-assist-result-card mt-4">
      <div class="ai-assist-result-card__header">
        @if (responseReceivedAt() != null) {
          <p class="ai-assist-result-card__new-badge">{{ 'AI_ASSIST.NEW_RESPONSE' | translate }}</p>
        }
        <h3 class="ai-assist-result-card__goal">{{ result().plan!.goal }}</h3>
        <p class="ai-assist-result-card__meta">
          {{ 'AI_ASSIST.CONFIDENCE' | translate }}: {{ toPercent(result().plan!.overallConfidence) }}
          @if (result().plan!.steps.length > 0) {
            · {{ 'AI_ASSIST.STEPS' | translate }}: {{ result().plan!.steps.length }}
          }
        </p>
      </div>

      <details class="ai-assist-result-card__details">
        <summary class="ai-assist-result-card__details-summary">
          <span>{{ 'AI_ASSIST.MODE_AND_ASSUMPTIONS' | translate }}</span>
        </summary>
        <div class="ai-assist-result-card__details-content">
          <p>Mode: <strong>{{ result().plan!.executionMode }}</strong> · {{ result().plan!.modeReason }} · mode confidence: {{ toPercent(result().plan!.modeConfidence) }}</p>
          @if (result().plan!.assumptions.length) {
            <p class="font-semibold mt-2">{{ 'AI_ASSIST.ASSUMPTIONS' | translate }}</p>
            <ul class="list-disc list-inside mt-1 space-y-0.5">
              @for (a of result().plan!.assumptions; track a) {
                <li>{{ a }}</li>
              }
            </ul>
          }
        </div>
      </details>

      @if (result().plan!.clarificationQuestions.length) {
        <div class="ai-assist-result-card__questions">
          <p class="ai-assist-result-card__questions-title">{{ 'AI_ASSIST.QUESTIONS' | translate }}</p>
          <p class="ai-assist-result-card__questions-hint">{{ 'AI_ASSIST.CLICK_TO_SEND' | translate }}</p>
          <div class="ai-assist-result-card__options">
            @for (q of result().plan!.clarificationQuestions; track q) {
              <button
                type="button"
                class="ai-assist-result-card__option"
                [disabled]="isLoading()"
                (click)="sendClarificationOption.emit(q)"
              >
                <span class="ai-assist-result-card__option-icon" aria-hidden="true">›</span>
                <span class="ai-assist-result-card__option-text">{{ q }}</span>
              </button>
            }
          </div>
        </div>
      }
      @if (result().warnings?.length) {
        <div class="alert alert-warning alert-soft mt-2">
          <div class="text-xs">
            <p class="font-medium mb-1">Auto-corrections / warnings</p>
            <ul class="list-disc list-inside">
              @for (w of result().warnings; track w) {
                <li>{{ w }}</li>
              }
            </ul>
          </div>
        </div>
      }
      @if (result().plan!.steps.length > 0) {
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
              @for (s of result().plan!.steps; track s.step.stepId; let i = $index) {
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
                      (change)="toggleStepConfirmed.emit({ stepId: s.step.stepId, checked: $any($event.target).checked })"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (currentStep(); as step) {
          <p class="text-xs opacity-80 mt-2">
            {{ 'AI_ASSIST.NEXT_STEP' | translate }}:
            @if (step.kind === 'dialog' && step.metadata) {
              {{ step.step.dialogId }} · {{ summarizeState(step.metadata.state) }}
            } @else if (step.code) {
              R code · {{ summarizeCode(step.code.script) }}
            }
          </p>
        }
      } @else if (result().plan!.clarificationQuestions.length === 0) {
        <p class="text-xs opacity-80 mt-2">{{ 'AI_ASSIST.INFORMATIONAL_RESPONSE' | translate }}</p>
      }
    </div>
    <div class="flex flex-wrap gap-2 mt-3">
      @if (result().plan!.steps.length > 0) {
        <button class="btn btn-sm btn-primary" (click)="applyCurrentStep.emit()" [disabled]="!canApplyCurrentStep()">
          {{ 'AI_ASSIST.OPEN_CURRENT_STEP' | translate }}
        </button>
        <button class="btn btn-sm btn-outline" (click)="advanceStep.emit()" [disabled]="!hasNextStep()">
          {{ 'AI_ASSIST.NEXT' | translate }}
        </button>
        <button class="btn btn-sm btn-outline" (click)="applyAllConfirmed.emit()" [disabled]="!hasAnyApprovableStep()">
          {{ 'AI_ASSIST.RUN_ALL_CONFIRMED' | translate }}
        </button>
      }
      <button class="btn btn-sm btn-ghost" (click)="clearPlan.emit()">
        {{ 'AI_ASSIST.CLEAR_PLAN' | translate }}
      </button>
    </div>
  `,
  styles: [`
    .ai-assist-result-card {
      border-radius: 0.5rem;
      border: 1px solid hsl(var(--b3));
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      padding: 1rem 1.25rem;
      border-left: 4px solid hsl(var(--su));
    }
    .ai-assist-result-card__header { margin-bottom: 0.75rem; position: relative; }
    .ai-assist-result-card__new-badge {
      position: absolute;
      top: -0.25rem;
      right: 0;
      font-size: 0.6875rem;
      font-weight: 600;
      color: hsl(var(--p));
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .ai-assist-result-card__goal {
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.35;
      color: hsl(var(--bc));
      margin: 0;
    }
    .ai-assist-result-card__meta {
      font-size: 0.8125rem;
      color: hsl(var(--bc) / 0.85);
      margin: 0.25rem 0 0;
    }
    .ai-assist-result-card__details {
      margin-top: 0.75rem;
      border-radius: 0.375rem;
      background: hsl(var(--b3));
      border: 1px solid hsl(var(--b3));
    }
    .ai-assist-result-card__details-summary {
      list-style: none;
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: hsl(var(--bc));
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 2.25rem;
    }
    .ai-assist-result-card__details-summary::-webkit-details-marker { display: none; }
    .ai-assist-result-card__details-summary::after {
      content: '';
      width: 0;
      height: 0;
      margin-left: auto;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 6px solid hsl(var(--bc) / 0.8);
      transition: transform 0.2s ease;
      flex-shrink: 0;
    }
    .ai-assist-result-card__details[open] .ai-assist-result-card__details-summary::after {
      transform: rotate(180deg);
    }
    .ai-assist-result-card__details-content {
      padding: 0 0.75rem 0.75rem;
      font-size: 0.8125rem;
      color: hsl(var(--bc) / 0.9);
      line-height: 1.5;
    }
    .ai-assist-result-card__details-content p { margin: 0; }
    .ai-assist-result-card__details-content ul { margin: 0; padding-left: 1rem; }
    .ai-assist-result-card__questions { margin-top: 1rem; }
    .ai-assist-result-card__questions-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: hsl(var(--bc));
      margin: 0 0 0.25rem;
    }
    .ai-assist-result-card__questions-hint {
      font-size: 0.75rem;
      color: hsl(var(--bc) / 0.75);
      margin: 0 0 0.5rem;
    }
    .ai-assist-result-card__options {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .ai-assist-result-card__option {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1rem;
      min-height: 2.75rem;
      font-size: 0.875rem;
      line-height: 1.4;
      text-align: left;
      color: hsl(var(--bc));
      background: hsl(var(--b1));
      border: 2px solid hsl(var(--p));
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .ai-assist-result-card__option:hover:not(:disabled) {
      background: hsl(var(--b2));
      border-color: hsl(var(--p) / 0.8);
      box-shadow: 0 0 0 2px hsl(var(--p) / 0.2);
    }
    .ai-assist-result-card__option:focus-visible {
      outline: 2px solid hsl(var(--p));
      outline-offset: 2px;
    }
    .ai-assist-result-card__option-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1;
      color: hsl(var(--p));
    }
    .ai-assist-result-card__option-text {
      flex: 1;
      min-width: 0;
      white-space: normal;
    }
    .ai-assist-result-card__option:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `],
})
export class AiAssistPlanResultComponent {
  /** Caller must ensure result.ok && result.plan. */
  readonly result = input.required<ResolveResult>();
  readonly responseReceivedAt = input<number | null>(null);
  readonly currentStep = input<ResolvedPlanStep | null>(null);
  readonly isLoading = input(false);
  readonly confirmedStepIds = input<string[]>([]);
  readonly canApplyCurrentStep = input(false);
  readonly hasNextStep = input(false);
  readonly hasAnyApprovableStep = input(false);

  readonly sendClarificationOption = output<string>();
  readonly toggleStepConfirmed = output<{ stepId: string; checked: boolean }>();
  readonly applyCurrentStep = output<void>();
  readonly advanceStep = output<void>();
  readonly applyAllConfirmed = output<void>();
  readonly clearPlan = output<void>();

  protected readonly toPercent = toPercent;
  protected readonly stepLabel = stepLabel;
  protected readonly summarizeState = summarizeState;
  protected readonly summarizeCode = summarizeCode;

  protected isStepConfirmed(stepId: string): boolean {
    return this.confirmedStepIds().includes(stepId);
  }
}
