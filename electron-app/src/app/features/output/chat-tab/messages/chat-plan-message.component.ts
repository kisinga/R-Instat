import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';
import type { ResolvedPlanStep } from '../../../../core/services/intent-resolver.service';

@Component({
  selector: 'app-chat-plan-message',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="flex justify-start">
      <div class="chat-bubble chat-bubble--plan">
        @if (plan(); as plan) {
          <div class="flex items-center gap-2 mb-2">
            <span class="badge badge-sm badge-primary">{{ 'AI_CHAT.PLAN' | translate }}</span>
            <span class="text-xs text-base-content/60">
              {{ 'AI_CHAT.CONFIDENCE' | translate }}: {{ (plan.overallConfidence * 100).toFixed(0) }}%
            </span>
          </div>

          <p class="text-sm font-medium mb-2">{{ plan.goal }}</p>

          @if (plan.assumptions.length > 0) {
            <div class="text-xs text-base-content/60 mb-2">
              <span class="font-semibold">{{ 'AI_CHAT.ASSUMPTIONS' | translate }}:</span>
              {{ plan.assumptions.join('; ') }}
            </div>
          }

          <div class="space-y-1.5">
            @for (step of plan.steps; track step.step.stepId; let i = $index) {
              <div class="flex items-start gap-2 p-2 rounded bg-base-100/50 border border-base-300">
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs checkbox-primary mt-0.5"
                  [checked]="isConfirmed(step.step.stepId)"
                  (change)="toggleConfirm.emit({ stepId: step.step.stepId, checked: $any($event.target).checked })"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="badge badge-xs" [class.badge-info]="step.kind === 'dialog'" [class.badge-warning]="step.kind === 'code'">
                      {{ step.kind }}
                    </span>
                    <span class="text-xs font-medium truncate">
                      {{ step.kind === 'dialog' ? step.metadata?.dialogId : 'R Code' }}
                    </span>
                    <span class="text-xs text-base-content/50 ml-auto">
                      {{ (step.step.confidence * 100).toFixed(0) }}%
                    </span>
                  </div>
                  <p class="text-xs text-base-content/70 mt-0.5">{{ step.step.rationale }}</p>
                </div>
                <button
                  class="btn btn-xs btn-primary"
                  (click)="executeStep.emit(step)"
                  [disabled]="!isConfirmed(step.step.stepId) && plan.clarificationQuestions.length > 0"
                >
                  {{ 'AI_CHAT.APPLY' | translate }}
                </button>
              </div>
            }
          </div>

          @if (plan.clarificationQuestions.length > 0) {
            <div class="mt-3">
              <p class="text-xs font-semibold text-base-content/70 mb-1">{{ 'AI_CHAT.QUESTIONS' | translate }}:</p>
              @for (q of plan.clarificationQuestions; track q) {
                <p class="text-xs text-base-content/60">• {{ q }}</p>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .chat-bubble {
      max-width: 90%;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      word-break: break-word;
    }
    .chat-bubble--plan {
      background: hsl(var(--b2));
      color: hsl(var(--bc));
      border: 1px solid hsl(var(--p) / 0.3);
      border-bottom-left-radius: 0.25rem;
    }
  `],
})
export class ChatPlanMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly executeStep = output<ResolvedPlanStep>();
  readonly toggleConfirm = output<{ stepId: string; checked: boolean }>();

  private readonly confirmedStepIds = signal<Set<string>>(new Set());

  plan() {
    const p = this.message().payload;
    return p.type === 'action-plan' ? p.plan : null;
  }

  isConfirmed(stepId: string): boolean {
    return this.confirmedStepIds().has(stepId);
  }
}
