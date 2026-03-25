import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import type { ChatMessage } from '../../../../core/models/chat.model';
import type { ResolvedPlanStep } from '../../../../core/services/intent-resolver.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-chat-plan-message',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <div class="chat chat-start">
      <div class="chat-header">
        <span class="text-xs opacity-50">AI</span>
        <span class="badge badge-xs badge-primary ml-1">{{ 'AI_CHAT.PLAN' | translate }}</span>
      </div>
      <div class="chat-bubble chat-bubble-ghost plan-bubble">
        @if (plan(); as plan) {
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs opacity-60">
              {{ 'AI_CHAT.CONFIDENCE' | translate }}: {{ (plan.overallConfidence * 100).toFixed(0) }}%
            </span>
          </div>

          <p class="text-sm font-medium mb-2">{{ plan.goal }}</p>

          @if (plan.assumptions.length > 0) {
            <div class="text-xs opacity-60 mb-2">
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
                  (change)="onToggleConfirm(step.step.stepId, $any($event.target).checked)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="badge badge-xs" [class.badge-info]="step.kind === 'dialog'" [class.badge-warning]="step.kind === 'code'">
                      {{ step.kind }}
                    </span>
                    <span class="text-xs font-medium">
                      {{ step.kind === 'dialog' ? step.metadata?.dialogId : 'R Code' }}
                    </span>
                    <span class="text-xs opacity-50 ml-auto">
                      {{ (step.step.confidence * 100).toFixed(0) }}%
                    </span>
                  </div>
                  <p class="text-xs opacity-70 mt-0.5 break-words">{{ step.step.rationale }}</p>
                </div>
                <button
                  class="btn btn-xs btn-primary flex-shrink-0"
                  (click)="executeStep.emit(step)"
                >
                  {{ 'AI_CHAT.APPLY' | translate }}
                </button>
              </div>
            }
          </div>

          @if (plan.clarificationQuestions.length > 0) {
            <div class="mt-3">
              <p class="text-xs font-semibold opacity-70 mb-1">{{ 'AI_CHAT.QUESTIONS' | translate }}:</p>
              <div class="space-y-1">
                @for (q of plan.clarificationQuestions; track q) {
                  <button
                    class="btn btn-sm btn-outline btn-block justify-start text-left text-xs whitespace-normal break-words leading-tight h-auto min-h-[2rem] py-1.5"
                    (click)="sendClarification.emit(q)"
                  >
                    {{ q }}
                  </button>
                }
              </div>
            </div>
          }
        }
      </div>
      <div class="chat-footer">
        <button
          class="btn btn-ghost btn-xs opacity-40 hover:opacity-100 gap-1"
          (click)="copyPlan()"
        >
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>
    </div>
  `,
  styles: [`
    .chat-bubble-ghost {
      --tw-bg-opacity: 1;
      background-color: hsl(var(--b2) / var(--tw-bg-opacity));
      color: hsl(var(--bc));
    }
    .plan-bubble {
      max-width: 95%;
    }
  `],
})
export class ChatPlanMessageComponent {
  readonly message = input.required<ChatMessage>();
  readonly executeStep = output<ResolvedPlanStep>();
  readonly sendClarification = output<string>();
  readonly toggleConfirm = output<{ stepId: string; checked: boolean }>();

  private readonly confirmedStepIds = signal<Set<string>>(new Set());
  private readonly toast = inject(ToastService);

  plan() {
    const p = this.message().payload;
    return p.type === 'action-plan' ? p.plan : null;
  }

  isConfirmed(stepId: string): boolean {
    return this.confirmedStepIds().has(stepId);
  }

  onToggleConfirm(stepId: string, checked: boolean): void {
    this.confirmedStepIds.update(s => {
      const next = new Set(s);
      if (checked) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
    this.toggleConfirm.emit({ stepId, checked });
  }

  copyPlan(): void {
    const p = this.plan();
    if (!p) return;
    const text = `Goal: ${p.goal}\n\nSteps:\n${p.steps.map((s, i) =>
      `${i + 1}. [${s.kind}] ${s.kind === 'dialog' ? s.metadata?.dialogId : 'R Code'} — ${s.step.rationale}`
    ).join('\n')}`;
    navigator.clipboard.writeText(text).then(
      () => this.toast.success('Copied to clipboard'),
      () => this.toast.error('Failed to copy')
    );
  }
}
